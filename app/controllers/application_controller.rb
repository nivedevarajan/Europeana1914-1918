# Filters added to this controller apply to all controllers in the application.
# Likewise, all the methods added will be available for all controllers.
class ApplicationController < ActionController::Base
  helper :all # include all helpers, all the time
  helper_method :sphinx_running?, :current_user, :contribution_fields, 
    :dropbox_authorized?, :dropbox_client, :dropbox_configured?, 
    :europeana_api_configured?
  
  protect_from_forgery # See ActionController::RequestForgeryProtection for details

  ##
  # Theme support via themes_for_rails gem.
  #
  # Only one of the following "theme..." lines should be active at a time.
  #
  
  # Use the #theme_resolver method to determine which theme to display,
  # allowing override via the "theme" query param, stored in the user's
  # session.
  theme :theme_resolver
  
  # Always use the v2 theme
  #theme 'v2'
  
  #
  ##
  
  before_filter :init_session, :init_views, :set_locale
  
  unless Rails.configuration.consider_all_requests_local 
    # Rescue general errors
    rescue_from Exception do |exception|
      render_http_error(:internal_server_error, exception)
    end

    # Rescue "400 Bad Request" exceptions
    rescue_from RunCoCo::BadRequest do |exception|
      render_http_error(:bad_request, exception)
    end

    # Rescue "403 Forbidden" exceptions
    rescue_from Aegis::AccessDenied do |exception|
      render_http_error(:forbidden, exception, :log => false)
    end
    
    # Rescue attempts to search when Sphinx offline.
    rescue_from RunCoCo::SearchOffline do |exception|
      render_http_error(:service_unavailable, exception, :template => "/errors/search_offline")
    end
    
    # Rescue Dropbox auth errors.
    rescue_from DropboxAuthError do |exception|
      redirect_to dropbox_connect_path(:redirect => controller.request.fullpath)
    end
  end
  
  # Rescue "404 Not Found" exceptions
  #
  # First tries to redirect to the same path with the locale prefixed if it's 
  # not already in the request params.
  rescue_from ActionController::MissingFile, ActiveRecord::RecordNotFound, ActionController::UnknownAction, ActionController::MethodNotAllowed, ActionController::RoutingError, ActionView::MissingTemplate do |exception|
    if !I18n.available_locales.include?(params[:locale].to_sym) && !request.fullpath.match(/^\/attachments\//)
      I18n.locale = request.compatible_language_from(I18n.available_locales) || Rails.configuration.i18n.default_locale
      redirect_to "/#{I18n.locale.to_s}#{request.fullpath}"
    else
      unless Rails.configuration.consider_all_requests_local
        render_http_error(:not_found, exception)
      end
    end
  end
  
  ##
  # Adds user's locale to default URL options
  #
  # @return [Hash] Default URL options
  def default_url_options(options = {})
    { :locale => I18n.locale }
  end
  
  # Returns the logged-in user object, or initialises a new instance if not logged in.
  def current_user
    @current_user ||= (super || User.new)
  end

  def dropbox_configured?
    RunCoCo::Dropbox.app_key.present? && RunCoCo::Dropbox.app_secret.present?
  end

  def dropbox_authorized?
    session.has_key?(:dropbox) && session[:dropbox].has_key?(:session)
  end

  def dropbox_client
    return false unless session.has_key?(:dropbox) && session[:dropbox].has_key?(:session)
    unless @dropbox_client.present?
      dbsession = DropboxSession.deserialize(session[:dropbox][:session])
      @dropbox_client = DropboxClient.new(dbsession, :app_folder)
    end
    @dropbox_client
  end

  protected
  
  ##
  # Displays error message for application errors, sending HTTP status code.
  #
  # @param [Symbol] status HTTP error code, e.g. :not_found
  # @param [Exception] exception the Ruby exception raised
  # @param [Hash] options error handling options
  # @option options [Boolean] :log Specifies whether to log the error. Default 
  #   is +true+.
  # @option options [String] :template Path to the template to render. Default 
  #   is derived from +status+, e.g. "/errors/not_found" when status => 
  #   :not_found.
  #
  def render_http_error(status, exception, options = {})
    options.assert_valid_keys(:log, :template)
    options.reverse_merge!(:log => true, :template => "/pages/error")

    if options[:log]
      RunCoCo.error_logger.error("#{status.to_s.humanize} \"#{exception.message}\"\n#{Rails.backtrace_cleaner.clean(exception.backtrace).join("\n")}")
    end
    
    respond_to do |format|
      format.html do
        @status = status
        render :template => options[:template], :status => status
      end
      format.any(:xml, :text, :csv, :json) do
        render :text => status.to_s.humanize, :status => status, :content_type => 'text/plain'
      end
    end
  end

  ##
  # Handle Devise redirects after sign in
  # 
  # @param (see Devise::Controllers::Helpers#after_sign_in_path_for)
  # @return [String] URL to redirect to
  #
  def after_sign_in_path_for(resource_or_scope)
    if params[:redirect] && (params[:redirect] =~ /^\//)
      params[:redirect]
    elsif resource_or_scope.is_a?(User) && resource_or_scope.may_access_admin_area?
      admin_root_url
    elsif resource_or_scope.is_a?(User) && resource_or_scope.role_name == 'contributor'
      contributor_dashboard_url
    else
      super
    end
  end
  
  ##
  #  Devise redirects after sign out
  #
  # @param (see Devise::Controllers::Helpers#after_sign_out_path_for)
  # @return [String] URL to redirect to 
  #
  def after_sign_out_path_for(resource_or_scope)
    home_path
  end
  
  ##
  # Allow "redirect" URL parameter to override redirect requests.
  #
  # Restricted to local redirects.
  #
  # @param options (see ActionController::Redirecting#redirect_to)
  # @param response_status (see ActionController::Redirecting#redirect_to)
  # @param [Boolean] check_params If false, do not check for URL redirect param
  # @return (see ActionController::Redirecting#redirect_to)
  #
  def redirect_to(options = {}, response_status = {}, check_params = true)
    if check_params && params[:redirect] && (params[:redirect] =~ /^\//)
      super(params[:redirect], response_status)
    else
      super(options, response_status)
    end
  end
  
  ##
  # Initialise session.
  #
  def init_session # :nodoc:
    # Store guest user details in session
    if current_user.role.name == 'guest'
      session[:guest] ||= {}
      if session[:guest][:contact_id].present?
        current_user.contact_id = session[:guest][:contact_id]
      end 
    end
  end
  
  ##
  # Initialise instance variables for views.
  #
  def init_views # :nodoc:
    # Flags for optional javascripts.
    # Views or controllers can set these to true to enable inclusion of 
    # the relevant javascript.
    @javascripts = {
      :attachments => false,
      :collapsible => false,
      :datepicker => false,
      :generate_password => false,
      :gmap_locate => false,
      :gmap_display => false,
      :language_other => false,
      :uploadify => false,
      :listing => false
    }
  end
  
  ##
  # Set locale from URL param or HTTP Accept-Language header
  #
  def set_locale # :nodoc:
    if params[:locale].blank?
      # Uses http_accept_language plugin
      locale = request.compatible_language_from(I18n.available_locales) || Rails.configuration.i18n.default_locale
    else
      raise ActionController::RoutingError, "No route matches #{request.path}" unless I18n.available_locales.include?(params[:locale].to_sym)
      locale = params[:locale]
    end
    
    I18n.locale = locale
    (Rails.configuration.action_mailer.default_url_options ||= {}).merge!(:locale => params[:locale])
  end
  
  ##
  # Return the name of the theme to use, for the theme_for_rails gem
  # 
  # @see https://github.com/lucasefe/themes_for_rails
  #
  def theme_resolver
    if params[:theme]
      session[:theme] = params[:theme]
    elsif session[:theme].nil?
      session[:theme] = 'v2'
    end
    session[:theme]
  end

  ##
  # Search contributions.
  #
  # Uses ThinkingSphinx if available. If not, falls back to a simple
  # non-indexed SQL query.
  #
  # With ThinkingSphinx, this will search against contribution titles and
  # any metadata fields flagged as searchable. The SQL fallback will only 
  # search the contribution titles. 
  #
  # If query param is +nil+, returns all contributions, unless other search
  # conditions given in options param.
  #
  # @param [Symbol] set Which set of contributions to search. Valid values:
  #   * +:approved+
  #   * +:submitted+
  #   * +:published+
  #   * +:draft+
  #   * +:rejected+
  #
  # @param [String] query The full-text query to pass to the search engine.
  #   Defaults to +nil+, returning all contributions in the named set.
  #
  # @param [Hash] options Search options
  # @option options [Integer,String] :contributor_id Only return results from
  #   the contributor with this ID.
  # @option options [TaxonomyTerm] :taxonomy_term Only return results
  #   categorised with this taxonomy term.
  # @option options [Integer,String] :page Number of page of results to return.
  # @option options [Integer,String] :per_page Number of results to return per 
  #   page.
  # @option options [String] :order Direction to order the results: 'ASC' or 
  #   'DESC'. Default is 'ASC' provided +sort+ param also present, otherwise
  #   set-specific.
  # @option options [String] :sort Column to sort on, e.g. 'created_at'. 
  #   Default is set-specific.
  # @option options Any other options valid for ThinkingSphinx or ActiveRecord 
  #   queries.
  #
  # @return [Array<Contribution>] Search results
  #
  # @see http://freelancing-god.github.com/ts/en/searching.html ThinkingSphinx 
  #   search options
  #
  def search_contributions(set, query = nil, options = {})
    raise ArgumentError, "set should be :draft, :submitted, :approved, :revised, :rejected, :withdrawn or :published, got #{set.inspect}" unless [ :draft, :submitted, :approved, :published, :revised, :rejected, :withdrawn ].include?(set)
    
    if sphinx_running?
      sphinx_search_contributions(set, query, options)
    else
      activerecord_search_contributions(set, query, options)
    end
  end
  
  ##
  # Tests whether Sphinx search engine is running.
  #
  # @return (see ThinkingSphinx.sphinx_running?)
  #
  def sphinx_running?
    ThinkingSphinx.sphinx_running?
  end
  
  ##
  # Checks whether the Europeana API library is configured.
  #
  # @return [Boolean]
  #
  def europeana_api_configured?
    defined?(Europeana) == 'constant' && Europeana.class == Module && Europeana::Search.key.present?
  end
  
  ##
  # Checks whether the Bing translator library is configured.
  #
  # @return [Boolean]
  #
  def bing_translator_configured?
    RunCoCo.configuration.bing_client_id.present? && RunCoCo.configuration.bing_client_secret.present?
  end
  
  ##
  # Translates a search query from the current locale to app's other locales.
  #
  # Queries are translated via Bing Translate, and translations cached for one
  # year.
  #
  # @param [String] query Query to translate from the current locale
  # @return [String,Array] Translations of the query, plus the query itself.
  #   If the translator library is not configured, return the original query.
  # @see #bing_translator_configured?
  #
  def bing_translate_query(query)
    return query unless query.present? && bing_translator_configured?
    
    bing_cache_key = "bing/#{I18n.locale}/#{query}"
    
    if fragment_exist?(bing_cache_key)
      return YAML::load(read_fragment(bing_cache_key))
    end
    
    translator = BingTranslator.new(RunCoCo.configuration.bing_client_id, RunCoCo.configuration.bing_client_secret)
    other_locales = I18n.available_locales.reject { |locale| locale == I18n.locale }
    logger.debug("Using Bing Translate API to translate \"#{query}\" from #{I18n.locale}...")
    query_translations = [ query ] + other_locales.collect do |locale|
      translation = translator.translate query, :to => locale
      logger.debug("... to #{locale} => #{translation}")
      translation
    end
    write_fragment(bing_cache_key, query_translations.to_yaml, :expires_in => 1.year)
    query_translations
  end
  
  ##
  # Returns the fields associated with contributions.
  #
  # This includes title, attachments (i.e. number of), created at timestamp, 
  # contributor (i.e. full name)
  #
  # @return [Array<Array>] Contribution fields. Each array contains two members:
  #   the first is the I18n'd field name, the second an identifier that can be
  #   passed to ContributionsHelper#contribution_field_value as the 
  #   +field_name+ param
  #
  def contribution_fields
    @contribution_fields ||= [
      [ t('attributes.title'), 'title'], 
      [ t('activerecord.attributes.contribution.attachments'), 'attachments' ], 
      [ t('activerecord.attributes.contribution.cataloguer'), 'cataloguer' ],
      [ t('activerecord.attributes.contribution.created_at'), 'created_at' ],
      [ t('activerecord.attributes.contribution.contributor'), 'contributor' ],
    ] + MetadataField.where(:contribution => true).collect do |field| 
      [ field.title, (field.field_type == 'taxonomy' ? field.collection_id.to_s : field.column_name) ]
    end
  end
  
  ##
  # Simple text query against contributions.
  #
  # Only intended as a backup if Sphinx is not running.
  #
  # @param (see #get)
  # @return (see #get)
  #
  def activerecord_search_contributions(set, query = nil, options = {}) # :nodoc:
    options = options.dup
    
    set_where = if (set == :published)
      [ 'current_status=?', ContributionStatus.published ]
    else
      [ 'current_status=?', ContributionStatus.const_get(set.to_s.upcase) ]
    end
    
    query_where = query.nil? ? nil : [ 'title LIKE ?', "%#{query}%" ]
    
    metadata_joins = []
    joins = [ ]
    if (sort = options.delete(:sort)).present?
      if MetadataRecord.taxonomy_associations.include?(sort.to_sym)
        sort_col = "taxonomy_terms.term"
        metadata_joins << sort.to_sym
      elsif sort == 'contributor'
        sort_col = "contacts.full_name"
        joins << { :contributor => :contact }
      else
        sort_col = sort
      end

      order = options.delete(:order)
      order = (order.present? && [ 'DESC', 'ASC' ].include?(order.upcase)) ? order : 'ASC'
      
      sort_order = "#{sort_col} #{order}"
    else
      if set == :submitted
        options[:order] = 'status_timestamp ASC'
      else
        options[:order] = 'status_timestamp DESC'
      end
    end
    
    contributor_id = options.delete(:contributor_id)
    contributor_where = contributor_id.present? ? { :contributor_id => contributor_id } : nil
    
    taxonomy_term = options.delete(:taxonomy_term)
    if taxonomy_term.present?
      taxonomy_field_alias = taxonomy_term.metadata_field.collection_id
      metadata_joins << taxonomy_field_alias
      if sort_col == "taxonomy_terms.term"
        taxonomy_term_where = { "#{taxonomy_field_alias}.id" => taxonomy_term.id }
      else
        taxonomy_term_where = { "taxonomy_terms.id" => taxonomy_term.id }
      end
    else
      taxonomy_term_where = nil
    end
    
    joins << { :metadata => metadata_joins }
    
    results = Contribution.joins(joins).where(set_where).where(query_where).where(contributor_where).where(taxonomy_term_where).order(sort_order)
      
    if options.has_key?(:page)
      results = results.paginate(options)
    end
    
    results
  end  
  
  ##
  # Searches contributions using Sphinx.
  #
  # Always does word-end wildcard queries by appending * to query if not already
  # present.
  #
  # @param (see #get)
  # @return (see #get)
  #
  def sphinx_search_contributions(set, query = nil, options = {}) # :nodoc:
    unless sphinx_running?
      raise RunCoCo::SearchOffline
    end
    
    options = options.dup.reverse_merge(:max_matches => ThinkingSphinx::Configuration.instance.client.max_matches)
    
    status_option = if (set == :published)
      { :with => { :status => ContributionStatus.published } }
    else
      { :with => { :status => ContributionStatus.const_get(set.to_s.upcase) } }
    end
    
    options.merge!(status_option)
    
    order = options[:order].present? && [ :desc, :asc ].include?(options[:order].downcase.to_sym) ? options.delete(:order).downcase.to_sym : :asc
    
    if sort = options.delete(:sort)
      if MetadataRecord.taxonomy_associations.include?(sort.to_sym)
        sort_col = nil
      elsif sort =~ /^field_/
        # Convert field name to index alias
        sort_col = sort.sub(/^field_/, 'metadata_')
      else
        sort_col = sort
      end
      
      options[:sort_mode] = order
      options[:order] = sort_col
    else
      if set == :submitted
        options[:order] = 'status_timestamp ASC'
      else
        options[:order] = 'status_timestamp DESC'
      end
    end
    
    contributor_id = options.delete(:contributor_id)
    if contributor_id.present?
      options[:with][:contributor_id] = contributor_id
    end
    
    taxonomy_term = options.delete(:taxonomy_term)
    if taxonomy_term.present?
      options[:with][:taxonomy_term_ids] = taxonomy_term.id
    end
    
    if query.blank?
      Contribution.search(options)
    else
      translated_query = bing_translate_query(query)
      if translated_query.is_a?(Array)
        options[:match_mode] = :extended
        translated_query = translated_query.uniq
        translated_query[0] = append_wildcard(translated_query[0])
        query_string = quote_terms(translated_query).join(' | ')
      else
        query_string = append_wildcard(translated_query)
      end
      Contribution.search(query_string, options)
    end
  end
  
  ##
  # Appends a wildcard character to a string unless already present.
  #
  # @param [String] string String to append wildcard to
  # @return [String] String with wildcard appended
  #
  def append_wildcard(string)
    string + (string.last == '*' ? '' : '*')
  end
  
  ##
  # Adds quote marks around string(s).
  #
  # @param [String,Array<String>] terms String or array of strings to quote.
  # @return [String,Array<String>] Quoted version of passed string(s).
  #
  def quote_terms(terms)
    quoted_terms = [terms].flatten.uniq.collect do |term|
      '"' + term + '"'
    end
    terms.is_a?(Array) ? quoted_terms : quoted_terms.first
  end
  
  ##
  # Requires and returns the Ruby-version-specific library used for CSV processing
  #
  # For Ruby >= 1.9, returns CSV, otherwise FasterCSV.
  #
  # @return [Class] CSV class
  #
  def csv_class # :nodoc:
    if RUBY_VERSION >= "1.9"
      require 'csv'
      CSV
    else
      require 'fastercsv'
      FasterCSV
    end
  end
end

