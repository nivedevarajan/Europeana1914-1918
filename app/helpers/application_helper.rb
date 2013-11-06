require 'digest/md5'

# Methods added to this helper will be available to all templates in the application.
module ApplicationHelper
  # Adapted from Formtastic::SemanticFormBuilder#inline_errors_for 
  # and ActionView::Helpers::ActiveRecordHelper#error_message_on
  def inline_errors_for(object, method, options = {})
    if (obj = (object.respond_to?(:errors) ? object : instance_variable_get("@#{object}"))) &&
      (errors = obj.errors[method])
      error_sentence([*errors], options) if errors.present?
    else
      ''
    end
  end
  
  # Copied from Formtastic::SemanticFormBuilder#error_sentence 
  def error_sentence(errors, options = {})
    content_tag(options[:content_tag] || :p, errors.to_sentence.untaint, :class => 'inline-errors')
  end
  
  # Render flash message
  def flash_message(status, message = nil)
    render :partial => '/layouts/flash_message', :locals => { :status => status, :message => message }
  end
  
  def redirect_path
    if params[:redirect] && (params[:redirect] =~ /^\//)
      params[:redirect]
    else
      nil
    end
  end
  
  ##
  # Generates path to static page.
  #
  # Overriden standard routing helper for scoped and globbed paths, to
  # prevent errors being produced by :path being interpreted as :locale.
  #
  # @param Path of static page to link to
  # @return [String] URL path
  def page_path(path)
    super(:path => path)
  end  

  def redirect_field(path = nil)
    hidden_field_tag 'redirect', (path.nil? ? redirect_path : path)
  end

  def request_uri
    controller.request.fullpath
  end

  def cancel_link(url)
    link_to I18n.t('actions.cancel'), (redirect_path.present? ? redirect_path : url)
  end

  def form_cancel_link(url)
    content_tag 'li', :class => 'cancel' do
      cancel_link(url)
    end
  end
  
  def session_key_name
    Rails.application.config.session_options[:key]
  end
  
  # True if the current request URI is a child of that generated by the 
  # given +options+.
  #
  # Always false if +options+ generate root URI.
  #
  # Based on Rails' current_page? helper.
  def current_page_parent?(options)
    unless request
      raise "You cannot use helpers that need to determine the current " \
            "page unless your view context provides a Request object " \
            "in a #request method"
    end

    url_string = url_for(options)

    # We ignore any extra parameters in the request_uri if the
    # submitted url doesn't have any either.  This lets the function
    # work with things like ?order=asc
    if url_string.index("?")
      request_uri = request.fullpath
    else
      request_uri = request.path
    end

    if [ root_path, root_url, home_path, home_url ].include?(url_string)
      false
    elsif url_string =~ /^\w+:\/\//
      "#{request.protocol}#{request.host_with_port}#{request_uri}" =~ Regexp.new("^#{url_string}")
    else
      request_uri =~ Regexp.new("^#{url_string}")
    end
  end
  
  ##
  # Returns RunCoCo configuration setting
  #
  # @example
  #   <%= configuration(:site_name) %> # => "RunCoCo"
  #
  # @param [Symbol] setting Setting name
  # @return Setting value
  #
  def configuration(setting)
    RunCoCo.configuration.send(setting)
  end
  
  def yes_or_no(boolean)
    boolean ? t('common.yes') : t('common.no')
  end
  
  ##
  # Returns an ID for a bundle of assets (CSS / JS), for named cache bundles
  #
  # @param [String,Array<String>] assets Bundle of assets
  # @return [String] ID as an MD5 hex digest of the assets
  #
  def asset_bundle_id(assets)
    assets = assets.dup
    assets = [ assets ].flatten.join(',')
    Digest::MD5.hexdigest(assets)
  end
  
  ##
  # Returns true if the HTTP referrer is one of the collection search URLs.
  #
  # @return [Boolean]
  #
  def referred_by_search?
    controller.request.env["HTTP_REFERER"].present? && controller.request.env["HTTP_REFERER"].match(Regexp.new('/(contributions/search|explore)'))
  end
  
  ##
  # Removes a leading slash from the passed string, if it has one.
  #
  # @param [String] string to remove a leading slash from
  # @return [String] string without the leading slash
  #
  def no_leading_slash(string)
    if string[0] == '/'
      string = string[1..-1]
    end
    string
  end
  
  ##
  # Recursively format a hash as an HTML definition list <dl>
  #
  # @param [Hash] hash Hash to format
  # @return [String] HTML safe nested <dl>
  #
  def hash_as_definition_list(hash)
    dl = "<dl>"
    hash.each do |key, value|
      dl << "<dt>#{key}</dt>"
      [ value ].flatten.each do |one_value|
        dl << "<dd>"
        dl << (one_value.is_a?(Hash) ? hash_as_definition_list(one_value) : h(one_value.to_s))
        dl << "</dd>"
      end
    end
    dl << "</dl>"
    dl.html_safe
  end
end

