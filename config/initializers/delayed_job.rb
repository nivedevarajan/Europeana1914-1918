Delayed::Worker.logger = Logger.new(Rails.root.join('log', "delayed_job-#{Rails.env}.log"))
