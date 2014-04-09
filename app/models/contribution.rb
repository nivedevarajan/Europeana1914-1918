##
# Contribution consisiting of files and metadata.
#
class Contribution < ActiveRecord::Base
  has_edm_mapping Europeana::EDM::Mapping::Story
  
  # Contributions have ActsAsTaggableOn tags
  acts_as_taggable

  case RunCoCo.configuration.search_engine
  when :active_record
    include ContributionSearch::ActiveRecord
  when :solr
    include ContributionSearch::Solr
  when :sphinx
    include ContributionSearch::Sphinx
  end

  belongs_to :contributor, :class_name => 'User'
  belongs_to :cataloguer, :class_name => 'User', :foreign_key => 'catalogued_by'
  belongs_to :metadata, :class_name => 'MetadataRecord', :foreign_key => 'metadata_record_id', :dependent => :destroy
  #--
  # @fixme: Destroy associated contact when contribution destroyed, 
  # *IF* this is a guest contribution, *AND* there are no other associated 
  # contributions
  #++
  belongs_to :guest

  has_many :attachments, :class_name => '::Attachment', :dependent => :destroy, :include => :metadata do
    def with_file
      select { |attachment| attachment.file.present? }
    end
    
    def with_file_uploaded
      select { |attachment| attachment.file_file_size.present? }
    end

    def to_json(options = nil)
      proxy_owner.attachments.collect { |a| a.to_hash }.to_json(options)
    end
    
    def cover_image
      with_file.select { |attachment| attachment.metadata.field_cover_image.present? }.first || with_file.first
    end
    
    def with_books
      attachments_with_books = []
      book_index = nil
      each do |attachment|
        if attachment.image?
          if book_index.nil?
            book_index = attachments_with_books.size
            attachments_with_books[book_index] = []
          end
          attachments_with_books[book_index] << attachment
        else
          attachments_with_books << attachment
        end
      end
      attachments_with_books
    end
  end
  
  has_many :statuses, :class_name => 'ContributionStatus', :dependent => :destroy, :order => 'created_at ASC'
  
  accepts_nested_attributes_for :metadata

  validates_presence_of :contributor_id, :if => Proc.new { RunCoCo.configuration.registration_required? }
  validates_presence_of :title
  validates_associated :metadata

  validate :validate_contributor_or_contact, :unless => Proc.new { RunCoCo.configuration.registration_required? }
  validate :validate_attachment_file_presence, :if => :submitting?
  validate :validate_cataloguer_role, :if => Proc.new { |c| c.catalogued_by.present? }

  attr_accessible :metadata_attributes, :title

  after_create :set_draft_status
  
  after_initialize :build_metadata_unless_present

  # Trigger syncing of public status of attachments to contribution's
  # published status.
  after_save :if => :current_status_changed? do |c|
    was_published = ContributionStatus.published.include?(current_status_was)
    unless was_published == published?
      c.attachments.each do |a|
        a.set_public
        a.save
      end
    end
  end

  # Number of contributions to show per page when paginating
  cattr_reader :per_page
  @@per_page = 20

  def self.published
    where(:current_status => ContributionStatus.published)
  end

  def contact
    by_guest? ? guest : contributor.contact
  end
  
  def by_guest?
    contributor.blank?
  end

  ##
  # Returns a symbol representing this contribution's current status
  #
  # @return [Symbol] (see ContributionStatus#to_sym)
  #
  def status
    current_status.nil? ? nil : ContributionStatus.to_sym(current_status)
  end

  ##
  # Changes the contribution's current status to that specified
  #
  # Creates a new ContributionStatus record.
  #
  # If the status param is a symbol, is should be one of those returned by 
  # {ContributionStatus#to_sym}. If it is an integer, is should be one of the
  # status constants defined in ContributionStatus, e.g. 
  # {ContributionStatus::SUBMITTED}.
  #
  # @param [Symbol,Integer] The status to change this contribution to.
  #
  def change_status_to(status, user_id = nil)
    if status.is_a?(Symbol)
      status = ContributionStatus.const_get(status.to_s.upcase)
    end
    user_id ||= contributor_id

    status_record = ContributionStatus.create(:contribution_id => id, :user_id => user_id, :status => status)
    if status_record.id.present?
      self.current_status = status_record.status
      self.status_timestamp = status_record.created_at
      save
    else
      false
    end
  end

  ##
  # Submits the contribution for approval.
  #
  # Creates a {ContributionStatus} record with status = 
  # {ContributionStatus::SUBMITTED}.
  #
  # @return [Boolean] True if {ContributionStatus} record saved.
  #
  def submit
    @submitting = true
    if valid?
      change_status_to(:submitted)
    else
      false
    end
  end
  
  def submitting?
    @submitting == true
  end

  def submitted?
    status == :submitted
  end

  def ready_to_submit?
    if @ready_to_submit.nil?
      if !draft? || attachments.blank?
        @ready_to_submit = false
      else
        valid?
        validate_attachment_file_presence
        @ready_to_submit = self.errors.blank?
      end
    end
    @ready_to_submit
  end
  
  def draft?
    status == :draft
  end

  def approved?
    status == :approved
  end

  def approve_by(approver)
    metadata.cataloguing = true
    if valid?
      change_status_to(:approved, approver.id)
    else
      false
    end
  end
  
  def pending_approval?
    [ :submitted, :revised, :withdrawn ].include?(status)
  end
  
  def rejected?
    status == :rejected
  end

  def reject_by(rejecter)
    change_status_to(:rejected, rejecter.id)
  end
  
  def published?
    ContributionStatus.published.include?(current_status)
  end
  
  def validate_contributor_or_contact
    if self.contributor_id.blank? && self.guest_id.blank?
      self.errors.add(:guest_id, I18n.t('activerecord.errors.models.contribution.attributes.guest_id.present'))
    end
  end
  
  def validate_attachment_file_presence
    self.errors.add(:base, I18n.t('views.contributions.digital_object.help_text.add_attachment')) unless attachments.with_file_uploaded.count == attachments.count
  end
  
  def validate_cataloguer_role
    self.errors.add(:catalogued_by, I18n.t('activerecord.errors.models.contribution.attributes.catalogued_by.role_name')) unless [ 'administrator', 'cataloguer' ].include?(User.find(catalogued_by).role_name)
  end
  
  alias :"rails_metadata_attributes=" :"metadata_attributes="
  def metadata_attributes=(*args)
    self.send(:"rails_metadata_attributes=", *args)
    self.metadata.for_contribution = true
  end
  
  alias :rails_build_metadata :build_metadata
  def build_metadata(*args)
    rails_build_metadata(*args)
    self.metadata.for_contribution = true
    self.metadata.set_default_collection_day
  end
  
  ##
  # Fetches and yields approved & published contributions for export.
  #
  # @example
  #   Contribution.export(:batch_size => 50) do |contribution|
  #     puts contribution.title
  #   end
  #
  # @param [Hash] options Export options
  # @option options [String] :exclude Exclude attachment records with files 
  #   having this extension
  # @option options [DateTime] :start_date only yield contributions published 
  #   on or after this date & time
  # @option options [DateTime] :end_date only yield contributions published on 
  #   or before this date & time
  # @option options [Integer] :batch_size (50) export in batches of this size; 
  #   passed to {#find_each}
  # @option options [Integer] :institution_id Restrict to contributions made by
  #   this institution
  # @yieldreturn [Contribution] exported contributions
  #
  def self.export(options)
    options.assert_valid_keys(:exclude, :start_date, :end_date, :batch_size, :set, :institution_id)
    options.reverse_merge!(:batch_size => 50)
    
    if options[:exclude].present?
      ext = options[:exclude].exclude
      unless ext[0] == '.'
        ext = '.' + ext
      end
    end
    
    query = Contribution.where(:current_status => ContributionStatus.published)
    
    if options[:start_date].present?
      query = query.where("status_timestamp >= ?", options[:start_date])
    end
    
    if options[:end_date].present?
      query = query.where("status_timestamp <= ?", options[:end_date])
    end
    
    if options[:set].present?
      case options[:set]
      when "ugc"
        query = query.where("users.institution_id IS NULL")
      when "institution"
        if options[:institution_id].present?
          query = query.where("users.institution_id" => options[:institution_id])
        else
          query = query.where("users.institution_id IS NOT NULL")
        end
      end
    end
    
    includes = [ 
      { :contributor => :contact },
      { :metadata => :taxonomy_terms },
      { :attachments => { :metadata => :taxonomy_terms } }
    ]
    
    query.includes(includes).find_in_batches(
      :batch_size => options[:batch_size]
    ) do |batch|
    
      batch.each do |contribution|
        
        class << contribution
          alias :all_attachments :attachments
          
          def export_attachments
            all_attachments.select { |a| a.file.present? }
          end
          
          def attachments
            export_attachments
          end
        end
        
        if options[:exclude]
          eval(<<-EVAL)
            def contribution.attachments
              export_attachments.reject { |a| File.extname(a.file.path) == '#{ext}' }
            end
          EVAL
        end
      
        yield contribution
        
      end
      
      ::ActiveRecord::Base.connection.clear_query_cache
      GC.start
    end
  end
  
protected

  def build_metadata_unless_present
    # Second condition prevents building empty metadata record when
    # {Contribution#select} specifically omits it.
    if self.metadata.blank? && self.attributes.has_key?("metadata_record_id")
      self.build_metadata
    end
  end
  
  ##
  # Creates a {ContributionStatus} record with status = 
  # {ContributionStatus::DRAFT}
  #
  def set_draft_status
    change_status_to(:draft)
  end
end

