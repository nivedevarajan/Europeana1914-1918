require 'net/http'

module Europeana
  ##
  # Interface to the Europeana API v2.
  #
  # @see http://www.europeana.eu/portal/api-introduction.html
  #
  module API
    ##
    # Europeana API key.
    #
    # @see http://www.europeana.eu/portal/api/registration.html
    #
    mattr_accessor :key
    
    autoload :Base,   'europeana/api/base'
    autoload :Errors, 'europeana/api/errors'
    autoload :Record, 'europeana/api/record'
    autoload :Search, 'europeana/api/search'
  end
end
