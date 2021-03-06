/*global europeana, jQuery, stWidget */
/*jslint browser: true, white: true */
(function( $ ) {

	'use strict';

	if ( !window.europeana ) {
		window.europeana = {};
	}

	europeana.sharethis = {

		Shareable: {},
		$sharethis_elm: {},

		/**
		 * @see http://support.sharethis.com/customer/portal/articles/475260-examples
		 * @see http://support.sharethis.com/customer/portal/articles/475079-share-properties-and-sharing-custom-information#Dynamic_Specification_through_JavaScript
		 *
		 * @param {object} $metadata
		 * jQuery object
		 *
		 * @param {object} $target_elm
		 * jQuery object
		 *
		 * @param {int} current
		 * the current item index
		 */
		addShareThis: function( $metadata, $target_elm, current ) {
			var
			$target = $target_elm.find('.st_sharethis_custom').eq(0),
			prettyfragement = '#prettyPhoto[gallery]/' + current + '/',
			options = {
				"element": $target[0],
				"image": $metadata.attr('data-image') || '',
				"title": $metadata.attr('data-title') || '',
				"type": "none",
				"service":"sharethis",
				"summary": $metadata.attr('data-summary') || '',
				"url": $metadata.attr('data-url') ? $metadata.attr('data-url') + prettyfragement : ''
			};

			this.Shareable = stWidget.addEntry( options );
			this.$sharethis_elm = $target;
		},

		/**
		 * @param {object} $metadata
		 * jQuery object
		 *
		 * @param {object} $target_elm
		 * jQuery object
		 *
		 * @param {int} current
		 * the current item index
		 */
		manageShareThis: function( $metadata, $target_elm, current ) {
			if ( $.isEmptyObject( this.Shareable ) ) {
				this.addShareThis( $metadata, $target_elm, current );
			} else {
				this.updateShareThis( $metadata, $target_elm, current );
			}
		},

		/**
		 * @param {object} $metadata
		 * jQuery object
		 *
		 * @param {object} $target_elm
		 * jQuery object
		 *
		 * @param {int} current
		 * the current item index
		 */
		updateShareThis: function( $metadata, $target_elm, current ) {
			var prettyfragement = '#prettyPhoto[gallery]/' + current + '/';
			this.Shareable.url = $metadata.attr('data-url') ? $metadata.attr('data-url') + prettyfragement : '';
			this.Shareable.title = $metadata.attr('data-title') || '';
			this.Shareable.image = $metadata.attr('data-image') || '';
			this.Shareable.summary = $metadata.attr('data-summary') || '';
			$target_elm.find('.st_sharethis_custom').eq(0).replaceWith( this.$sharethis_elm );
		}

	};

}( jQuery ));