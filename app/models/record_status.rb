class RecordStatus < ActiveRecord::Base
  belongs_to :record, :polymorphic => true
  validates_presence_of :status
  validates_inclusion_of :status, :in => lambda { |status| status.record.class.valid_record_statuses }
end
