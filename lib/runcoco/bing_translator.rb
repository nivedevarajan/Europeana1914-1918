module RunCoCo
  ##
  # Helper methods for working with Bing Translator API.
  #
  class BingTranslator
    class << self
      ##
      # Checks whether the Bing Translator library is configured.
      #
      # @return [Boolean]
      #
      def configured?
        RunCoCo.configuration.bing_client_id.present? && RunCoCo.configuration.bing_client_secret.present?
      end
      
      def translator
        @translator ||= ::BingTranslator.new(RunCoCo.configuration.bing_client_id, RunCoCo.configuration.bing_client_secret)
      end

      ##
      # Translates text from the current locale to app's other locales.
      #
      # @param [String] text Text to translate
      # @param [String,Symbol] from_locale Locale to translate from, defaults to
      #   the current locale.
      # @return [String,Hash] Translations of the query, plus the query itself.
      #   If the translator library is not configured, returns the original query.
      #   A returned hash will be keyed by locale, with the translations as values.
      #
      def translate(text, from_locale = I18n.locale)
        return text unless text.present? && configured?

        Rails.logger.debug("Using Bing Translate API to translate \"#{text}\" from #{from_locale}...")
        translations = { from_locale => text }

        other_locales = I18n.available_locales.reject { |locale| locale == from_locale }
        other_locales.select! { |locale| supported_language_codes.include?(locale.to_s) }
        other_locales.each do |to_locale|
          Rails.logger.debug("... to #{to_locale}")
          translations[to_locale] = translator.translate(text, :from => from_locale, :to => to_locale)
          Rails.logger.debug("    => \"#{translations[to_locale]}\"")
        end

        translations
      end

      def get_access_token
        begin
          translator = ::BingTranslator.new(RunCoCo.configuration.bing_client_id, RunCoCo.configuration.bing_client_secret)
          token = translator.get_access_token
          token[:status] = 'success'
        rescue Exception => exception
          RunCoCo.error_logger.error("Bing Translator: \"#{exception.message}\"")
          token = { :status => exception.message }
        end

        return token
      end
      
      def supported_language_codes
        cache_key = "bing_translator/supported_language_codes"
        
        if Rails.cache.exist?(cache_key)
          codes = YAML::load(Rails.cache.read(cache_key))
        else
          begin
            codes = translator.supported_language_codes
            expiration = Rails.configuration.cache_store.first == :dalli_store ? 1.month.from_now.to_i : 1.month
            Rails.cache.write(cache_key, codes.to_yaml, :expires_in => expiration)
          rescue Exception => e
            if e.message.match(/TranslateApiException/)
              codes = []
            else
              raise e
            end
          end
        end
        
        codes
      end
    end
  end
end
