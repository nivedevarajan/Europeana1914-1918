/*global console, jQuery, microsoft */
/*jslint browser: true, white: true */
/**
 * @class europeana
 */
window.europeana = (function( europeana, $ ) {

	'use strict';

	/**
	 * manages the translator service using the azure marketplace
	 * microsoft translator
	 *
	 * @class translator
	 */
	europeana.translator = (function( translator ) {

		var
		/**
		 * a jQuery object that allows a user to return to the original language text.
		 *
		 * @name translator#$return_to_original_text
		 * @type {object}
		 */
		$return_to_original_text,

		/**
		 * jQuery object that represent the DOM element that contains the language
		 * services html
		 *
		 * @name translator#$services
		 * @type {object}
		 */
		$services,

		/**
		 * jQuery object that represent the DOM element that is the language
		 * dropdown selector
		 *
		 * @name translator#$services_select
		 * @type {object}
		 */
		$services_select,

		/**
		 * jQuery object that represents the DOM element that is the
		 * loading spinner
		 *
		 * @name #translator#$translations_loading_icon
		 * @type {jQuery}
		 */
		$translations_loading_icon,

		/**
		 * indicates how many translate callbacks the application is waiting on
		 *
		 * @name #translator#callbacks_waiting
		 * @type {int}
		 */
		callbacks_waiting = 0,

		/**
		 * Language ISO codes matched with their corresponding localised language
		 * names based on the locale passed to
		 * microsoft.translator.getLanguageCodesAndNames()
		 *
		 * @name translator#language_codes_and_names
		 * @type {object}
		 */
		language_codes_and_names = {},

		/**
		 * Language names that correspond with the translator#languages_for_translate
		 * based on the locale passed to microsoft.translator.getLanguageNames()
		 *
		 * @name translator#language_names
		 * @type {array}
		 */
		language_names = [],

		/**
		 * ISO language codes
		 *
		 * @name translator#languages_for_translate
		 * @type {array}
		 */
		languages_for_translate = [],

		/**
		 * a cache container for previous translations request during this page visit
		 *
		 * @name translator#translation_cache
		 * @type {array}
		 */
		translation_cache = [],

		/**
		 * a collection of text nodes to be translated as jQuery objects
		 *
		 * @name translator#translation_nodes
		 * @type {array}
		 */
		translation_nodes = [],

		/**
		 * a collection of the original text nodes to be translated as jQuery objects
		 *
		 * @name translator#translation_nodes
		 * @type {array}
		 */
		translation_nodes_original = [],

		/**
		 * an html template representing the translation services container
		 *
		 * @name translator#translation_services_html
		 * @type {string}
		 */
		translation_services_html =
			'<div id="translation-services">' +
				'<div id="microsoft-translate-element">' +
					'<select>' +
						'<option value="">' + I18n.t( 'javascripts.translate.translate-to' ) + '</option>' +
					'</select>' +
					'<a ' +
						'id="return-to-original-text" ' +
						'href="" ' +
						'title="' + I18n.t( 'javascripts.translate.return-to-language' ) +
					'">' +
						I18n.t( 'javascripts.translate.return-to-language' ) +
					'</a>' +
					'<span>Powered by <span class="bold">Microsoft®</span> Translator</span>' +
				'</div>' +
			'</div>' +
			'<div ' +
				'id="translations-loading-icon" ' +
				'class="loading-spinner" ' +
				'title="' + I18n.t( 'javascripts.loading' ) + '">' +
			'</div>';

		/**
		 * @param {string} msg
		 */
		function debug( msg ) {
			if ( window.console && console.log ) {
				console.log( msg );
			}
		}

		/**
		 * @returns {object}
		 */
		function getAccessToken() {
			var
			result = {};

			//if ( retrieve_new_token ) {
			//	return retrieveNewToken();
			//}

			if (
				RunCoCo &&
				RunCoCo.bing_access_token &&
				RunCoCo.bing_access_token.access_token
			) {
				result = RunCoCo.bing_access_token.access_token;
			}

			if ( !result ) {
				debug(
					'europeana.translator.getAccessToken: no microsoft translator ' +
					'access token was available'
				);
			}

			return result;
		}

		/**
		 * @param {string} translate_elm_selector
		 * css selector that indicates the DOM elements that should be translated
		 */
		function captureOriginalNodes( translate_elm_selector ) {
			$( translate_elm_selector ).each( function() {
				translation_nodes.push( $( this ) );

				// don’t store as jQuery objects as they will change with the translation
				// update. store the html as sometimes the content is surrounded in html
				translation_nodes_original.push( $( this ).html() );
			});
		}

		function displayTranslationServices() {
			if ( callbacks_waiting > 0 ) {
				return;
			}

			// hide the loading spinner
			// display the language drop down
			// display the return to original language link
			// keep this order - otherwise loading icon doesn’t always fade out
			// especially when using the translation_cache
			$services.fadeTo( 'fast', 1.0, function() {
				$translations_loading_icon.fadeOut(function() {
					$return_to_original_text.slideDown( 'slow' );
				});
			});
		}

		function displayTranslationsLoading() {
			$services.fadeTo( 'fast', 0.2, function() {
				$translations_loading_icon.fadeIn();
			});
		}

		/**
		 * stores translations received from microsoft.translator.translate in
		 * a local cache. the cache is only good for this session.
		 *
		 * @todo create a persistent cache
		 *
		 * @param {object} translation
		 * @example
		   {
					$elm: $elm,
					index: index,
					locale_requested: locale_requested,
					response: response
		   }
		 */
		function addTranslationToCache( translation ) {
			if ( !$.isArray( translation_cache[ translation.locale_requested ] ) ) {
				translation_cache[ translation.locale_requested ] = [];
			}

			if ( !$.isPlainObject( translation_cache[ translation.locale_requested ][ translation.index ] ) ) {
				translation_cache[ translation.locale_requested ][ translation.index ] = translation;
			}
		}

		/**
		 * @param {object} $elm
		 * the DOM element to receive the content
		 *
		 * @param {string} content
		 * text or html
		 */
		function addContentWithFlashHighlight( $elm, content ) {
			$elm.html( content );
			js.utils.flashHighlight( $elm, '#ffff00', '#ffffff', 1500 );
		}

		function handleReturnToOriginal( evt ) {
			evt.preventDefault();

			$.each( translation_nodes, function( index ) {
				// restore as html in case the original content contained html
				addContentWithFlashHighlight( $( this ), translation_nodes_original[ index ] );
			});

			$services_select.val( '' );
			$return_to_original_text.slideToggle();
		}

		/**
		 * callback for the microsoft.translator.translate method
		 *
		 * @param {object} status
		 * @param {object} translation
		 * @example
		   {
					$elm: $elm,
					index: index,
					locale_requested: locale_requested,
					response: response
		   }
		 */
		function translateCallback( status, translation ) {
			if ( $.isEmptyObject( translation.$elm ) ) {
				debug(
					'europena.translator.handleTranslateRequest: ' +
					'$elm is not an object'
				);
			} else if ( status.status === 'success' ) {
				addContentWithFlashHighlight( translation.$elm, translation.response );
				addTranslationToCache( translation );
			} else {
				debug(
					'europena.translator.handleTranslateRequest: ' +
					'callback status - ' + status.status
				);

				if ( status.status === 'parsererror' ) {
					// assume a new token is needed
					// make sure all callbacks have been received?
					// attempt only once to get a new token
					// call the translate method again with the same info
				}
			}

			callbacks_waiting -= 1;
			displayTranslationServices();
		}

		/**
		 * @param {Event} evt
		 * jQuery Event object
		 */
		function handleTranslateRequest( evt ) {
			var
			locale_requested = $(this).val();

			// no translation requested
			if ( locale_requested.length < 1 ) {
				debug(
					'europena.translator.handleTranslateRequest: locale requested ' +
					'[' + locale_requested + '] is empty'
				);

				return;
			}

			// validate locale requested
			if ( $.inArray( locale_requested, languages_for_translate ) === -1 ) {
				debug(
					'europeana.translator.handleTranslateRequest: locale requested ' +
					'[' + locale_requested + '] is not valid'
				);

				return;
			}

			// trigger google analytics event
			com.google.analytics.trackEvent(
				'Object description translations',
				locale_requested,
				window.location.href.replace( 'www.', '' )
			);

			// hide the language drop down, display loading spinner
			displayTranslationsLoading();

			// cycle through text nodes and send them off for translation
			$.each( translation_nodes, function( index ) {

				// use cache if translation already exists
				if (
					translation_cache[ locale_requested ] &&
					translation_cache[ locale_requested ][ index ] &&
					$.isPlainObject( translation_cache[ locale_requested ][ index ] )
				) {
					callbacks_waiting += 1;

					translateCallback.call(
						translator,
						{ status: 'success' },
						translation_cache[ locale_requested ][ index ]
					);

					return true;
				}

				// need these to be defined per scope
				var
				$elm = $( this ),
				options = {
					appId: getAccessToken(),
					to: locale_requested
				};

				// use the node’s original content, which may contain html
				// this insures that translations are not made on results of
				// previous translations
				options.text = translation_nodes_original[ index ];

				options.callback = function( status, response ) {
					var translation = {
						$elm: $elm,
						index: index,
						locale_requested: locale_requested,
						response: response
					};

					translateCallback.call( translator, status, translation );
				}

				microsoft.translator.translate( options );
				callbacks_waiting += 1;

				return true;
			});
		}

		function addReturnToOriginalClickHandler() {
			$return_to_original_text.on( 'click', handleReturnToOriginal );
		};

		function addLanguageSelectorChangeHandler() {
			$services_select.on( 'change', handleTranslateRequest );
		}

		function addLanguagesToLanguageSelector() {
			if ( languages_for_translate.length !== language_names.length ) {
				debug(
					'europeana.translator.addLanguagesToLanguageSelector: ' +
					'language array lengths do not match'
				);

				return;
			}

			var
			html = '';

			if ( !$.isEmptyObject( language_codes_and_names ) ) {
				$.each( language_codes_and_names, function( index, value ) {
					languages_for_translate.push( index );
					html += '<option value="' + index + '">' + value + '</option>';
				});
			} else {
				$.each( languages_for_translate, function( index ) {
					html +=
						'<option value="' + languages_for_translate[ index ] + '">' +
							language_names[ index ] +
						'</option>';
				});
			}

			$services_select.append( html );
		}

		/**
		 * callback for the microsoft.translator.getLanguageNames method
		 *
		 * @param {object} status
		 * @param {array} response
		 */
		function languageNamesCallback( status, response ) {
			if ( status.status !== 'success' ) {
				debug( 'europeana.translator.languageNamesCallback: status !== success' );
				return;
			}

			language_names = response;
			addLanguagesToLanguageSelector();
		}

		/**
		 * initiates an api call to microsoft.translator.getLanguageNames
		 */
		function prepLanguageNames() {
			var
			options = {
				appId: getAccessToken()
			};

			if ( language_names.length < 1 ) {
				if ( RunCoCo && RunCoCo.locale ) {
					options.locale = RunCoCo.locale;
				}

				options.callback = languageNamesCallback;
				microsoft.translator.getLanguageNames( options );
			} else {
				addLanguagesToLanguageSelector();
			}
		}

		/**
		 * callback for the microsoft.translator.getLanguagesForTranslate method
		 *
		 * @param {object} status
		 * @param {array} response
		 */
		function languagesForTranslateCallback( status, response ) {
			if ( status.status !== 'success' ) {
				debug( 'europeana.translator.languagesForTranslateCallback: status !== success' );
				return;
			}

			languages_for_translate = response;
			prepLanguageNames();
		}

		/**
		 * begin the process of preparing the language dropdown selector options.
		 *
		 * attempt to get a static code/name object from microsoft.translator for
		 * the current RunCoCo.locale. if it doesn’t exist, make the api calls
		 * starting with microsoft.translator.getLanguagesForTranslate
		 */
		function prepLanguagesForTranslate() {
			var
			options = {
				appId: getAccessToken()
			};

			if ( RunCoCo && RunCoCo.locale ) {
				language_codes_and_names =
					microsoft.translator.getLanguageCodesAndNames( RunCoCo.locale );

				if ( !$.isEmptyObject( language_codes_and_names ) ) {
					addLanguagesToLanguageSelector();
					return;
				}
			}

			if ( languages_for_translate.length < 1 ) {
				options.callback = languagesForTranslateCallback;
				microsoft.translator.getLanguagesForTranslate( options );
			} else {
				prepLanguageNames();
			}
		}

		/**
		 * add translation services to the page
		 * setup variables that refer to that DOM element and the language dropdown
		 *
		 * @param {string} services_selector
		 */
		function addTranslationServices( services_selector ) {
			$( services_selector ).append( $( translation_services_html ) );
			$services =	$( '#translation-services' );
			$services_select = $services.find( 'select' );
			$return_to_original_text = $services.find( '#return-to-original-text' ).hide();
			$translations_loading_icon = $( '#translations-loading-icon' ).hide();
		}

		/**
		 * @param {string} services_selector
		 * css selector that indicates which DOM element receives
		 * the translation services html, which includes the language
		 * selector dropdown
		 *
		 * @param {string} translate_elm_selector
		 * css selector that indicates which DOM elements should be translated
		 */
		translator.init = function( services_selector, translate_elm_selector ) {
			if ( !microsoft && !microsoft.translator ) {
				debug( 'europeana.translator.init: microsoft.translator has not loaded' );
				return;
			}

			if ( !getAccessToken() ) {
				return;
			}

			addTranslationServices( services_selector );
			prepLanguagesForTranslate();
			addLanguageSelectorChangeHandler();
			addReturnToOriginalClickHandler();

			captureOriginalNodes( translate_elm_selector );
		};

		return translator;

	}( europeana.translator || {} ));

	return europeana;

}( window.europeana || {}, jQuery ));