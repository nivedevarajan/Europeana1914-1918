/*global jQuery */
/*jslint browser: true, plusplus: true, regexp: true, white: true */
(function( $ ) {

	'use strict';
	var pdf_viewer =
		( jQuery(window).width() <= 768 || jQuery(window).height() <= 500 )
		&& ( !( /iPad/.test( navigator.platform ) && navigator.userAgent.indexOf( "AppleWebKit" ) > -1 ) )
		? false
		: true,
		$contributions_featured = jQuery('#contributions-featured'),
		add_lightbox = pdf_viewer,


	carousels = {
		ajax_load_processed : true,
		$featured_carousel : null,
		$pagination_counts : $('#pagination-counts'),
		pagination_total : $('#pagination-total').text(),
		$pagination_next : jQuery('#carousel-pagination .pagination a[rel=next]').eq(0),
		$contributions_featured_ul : jQuery('#institution-featured ul'),

		addImagesToLightbox : function( $new_content ) {
			var	$pp_full_res = jQuery('#pp_full_res'),
					$new_links = $new_content.find('#institution-featured > ul > li > a');

			if ( $pp_full_res.length < 1 ) {
				lightbox.init();
				return;
			}

			$new_links.each(function() {
				var $elm = jQuery(this);
				window.pp_images.push( $elm.attr('href') );
				window.pp_descriptions.push( $elm.attr('data-description') );
			});

			$.prettyPhoto.changePage('next');
		},

		/**
		 *	ajax methods
		 */
		handleContentLoad : function( responseText, textStatus, XMLHttpRequest ) {
			var $new_content = this.$new_content.clone();

			if ( this.ajax_load_processed ) {
				return;
			}

			this.$contributions_featured_ul.append( this.$new_content.find('#institution-featured ul li') );
			this.$featured_carousel.ajaxCarouselSetup();
			this.$pagination_next = this.$new_content.find('#carousel-pagination .pagination a[rel=next]');
			this.ajax_load_processed = true;

			if ( add_lightbox ) {
				this.addImagesToLightbox( $new_content );
			} else {
				lightbox.removeLightboxLinks();
			}

			this.$featured_carousel.$next.trigger('click');
			this.$featured_carousel.hideOverlay();
		},

		init: function() {
			var self = this;

			$('#institution-featured').imagesLoaded( function() {
				self.$featured_carousel =
					$('#institution-featured').rCarousel({
						item_width_is_container_width : true,
						items_collection_total : parseInt( self.pagination_total, 10 ),
						callbacks : {
							before_nav: function( dir ) {
								carousels.paginationContentCheck( dir );
							},
							after_nav : function() {
								carousels.updatePaginationCount();
							}
						}
					}).data('rCarousel');

				carousels.updatePaginationCount();
			});
		},

		/**
		 *	decide whether or not to try and pull in additional carousel assets
		 *	additional assets are pulled in via the following url schemes
		 *
		 *		full page comes from next link -> http://localhost:3000/en/contributions/2226?page=2
		 *		partial page, default count -> http://localhost:3000/en/contributions/2226/attachments?carousel=true&page=2
		 *    partial page, custom count -> http://localhost:3000/en/contributions/2226/attachments?carousel=true&page=2&count=2
		 */
		paginationContentCheck : function( dir ) {
			var href,
					next_page_link,
					next_carousel_item = 0,
					current_carousel_count = this.$featured_carousel.items_length,
					current_carousel_item = this.$featured_carousel.get('current_item_index') + 1;

			this.$featured_carousel.options.cancel_nav = true;
			next_page_link = this.$pagination_next.attr('href');

			if ( dir === 'next' ) {
				next_carousel_item = current_carousel_item + 1;
			} else if ( current_carousel_item > 1 )  {
				next_carousel_item = current_carousel_item - 1;
			} else {
				next_carousel_item = 1;
			}

			if ( !next_page_link || next_carousel_item <= current_carousel_count  ) {
				this.$featured_carousel.options.cancel_nav = false;
				return;
			}

			next_page_link = next_page_link.split('?');

			href =
				next_page_link[0] + '?carousel=true&' +
				//( next_page_link[0].indexOf('/attachments') === -1 ? '/attachments?carousel=true&' : '?' ) +
				next_page_link[1];

			this.retrieveContent( href );
		},

		retrieveContent : function( href ) {
			var self = this;

			if ( !href || !self.ajax_load_processed ) { return; }
			self.ajax_load_processed = false;
			self.$new_content = jQuery('<div/>');

			try {
				self.$featured_carousel.$overlay.fadeIn();

				self.$new_content.load(
					href,
					null,
					function( responseText, textStatus, XMLHttpRequest ) {
						self.handleContentLoad( responseText, textStatus, XMLHttpRequest );
					}
				);

			} catch(e) {
				console.log(e);
			}
		},

		updatePaginationCount : function() {
			this.$pagination_counts.html(
				I18n.t('javascripts.thumbnails.item') + ' ' +	( this.$featured_carousel.get('current_item_index') + 1 ) +	' ' + I18n.t('javascripts.thumbnails.of') + ' ' + this.pagination_total
			);
		}
	},

	lightbox = {
		setupPrettyPhoto : function() {
			var self = this,
					ppOptions = {
						description_src : 'data-description',
						overlay_gallery : false,
						changepagenext : self.handlePageChangeNext,
						changepageprev : self.handlePageChangePrev,
						changepicturecallback : self.handlePictureChange,
						collection_total : carousels.pagination_total,
						show_title : false,
						social_tools: false
					};

			$("a[rel^='prettyPhoto']").prettyPhoto( ppOptions );
		},

		handlePageChangeNext : function( keyboard ) {
			if ( !keyboard ) {
				carousels.$featured_carousel.$next.trigger('click');
			}
		},

		handlePageChangePrev : function( keyboard ) {
			if ( !keyboard ) {
				carousels.$featured_carousel.$prev.trigger('click');
			}
		},

		removeLightboxLinks : function() {
			$('#institution-featured a').each(function() {
				var $elm = jQuery(this),
						contents = $elm.contents();

				if ( !$elm.hasClass('pdf') && !$elm.hasClass('original-context') ) {
					$elm.replaceWith(contents);
				}
			});

			$('#institution-featured .view-item').each(function() {
				jQuery(this).remove();
			});
		},

		init : function() {
			if ( add_lightbox) {
				this.setupPrettyPhoto();
			} else {
  				this.removeLightboxLinks();
			}
		}
	},

	map = {

	    cancel:function(){
	    	$("#map-container").remove();
	    },
		init:function(){

			if(typeof latLong == 'undefined'){
				map.cancel();
				return;
			}

			if(typeof latLong[0] =='string'  || latLong.length != 2){
				map.cancel();
				return;
			}

			// this test could happen on the back end too

			var regex = /^\s*-?\d+\.\d+\,\s?-?\d+\.\d+\s*$/

			if( ! latLong.join(',').match(regex) ){
				map.cancel();
				return;
			}

			var mapLatitude  = parseFloat(latLong[0]);
			var mapLongitude = parseFloat(latLong[1]);
			var mapZoom      = typeof mapZoom != 'undefined' && mapZoom.length && parseInt(mapZoom).length ? parseInt(mapZoom) : 8;

			var rootJsUrl    = themePath + 'javascripts/com/leaflet/';
			var rootCssUrl   = themePath + 'stylesheets/com/leaflet/';
			var dependencies = [
			    'http://maps.googleapis.com/maps/api/js?sensor=false&amp;libraries=places&amp;key=AIzaSyARYUuCXOrUv11afTLg72TqBN2n-o4XmCI',
				'leaflet.js',
				'Leaflet-MiniMap-master/src/Control.MiniMap.js',
				'Leaflet-Pan/L.Control.Pan.js',
				'leaflet-plugins-master/layer/tile/Google.js',
				'leaflet.min.css',
				'leaflet.ie.css',
				'Leaflet-MiniMap-master/src/Control.MiniMap.css'
			];

			console.log(JSON.stringify(dependencies));


        	var recursiveLoad = function(index){
        		index = index ? index : 0;
        		if(dependencies.length > index){
					if( dependencies[index].split('.').pop() == 'css'){
						$('head').append('<link rel="stylesheet" href="' + rootCssUrl + dependencies[index] + '" type="text/css"/>');
    					recursiveLoad(index + 1);
					}
					else{
	          			$.ajax({
            				"url": dependencies[index].indexOf('http') == 0 ? dependencies[index] :  rootJsUrl + dependencies[index],
            				"dataType": "script",
            				"success": function(){
            					recursiveLoad(index + 1);
            				},
            				"fail":function(e){console.log('fail: ' + e);},
            				"error":function(e){console.log('error: ' + e);},
            	            "contentType" :	"application/x-www-form-urlencoded;charset=UTF-8"
            			});
					}
        		}
        		else{
        			var mqTilesAttr = 'Tiles &copy; <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png" />';

        			// map quest
        			var mq = new L.TileLayer(
        				'http://otile{s}.mqcdn.com/tiles/1.0.0/{type}/{z}/{x}/{y}.png',
        				{
        					minZoom: 4,
        					maxZoom: 18,
        					attribution: mqTilesAttr,
        					subdomains: '1234',
        					type: 'osm'
        				}
        			);

        			var map = L.map('map', {
        			    center: new L.LatLng(mapLatitude, mapLongitude),
        			    zoomControl: false,
        			    zoom: mapZoom
        			});

        			L.Icon.Default.imagePath = rootCssUrl + 'images/';
    				L.marker([mapLatitude, mapLongitude]).addTo(map);

        			var europeanaCtrls = jQuery('<div id="europeana-ctrls">').prependTo('#map-container');

        			var EuropeanaLayerControl = function(map, ops){

        				var self = this;

        				self.ops = ops;
        				self.map = map;
        				self.grp = null;

        				self._setLayer = function(index){
        					var layer = self.ops[index].layer;
        					self.grp.clearLayers();
        					self.grp.addLayer(layer);

        					jQuery(self.cmp.find("span")).removeClass('active');
        					jQuery(self.cmp.find("span").get(index)).addClass('active');
        				};

        				var html	= '';
        				var layers	= [];

        				jQuery.each(self.ops, function(i, ob){
        					html += '<a href="#' + ob.title + '"><span class="' + i + '">' + ob.title + '</span></a>';
        					layers[layers.length] = ob.layer;
        				});


        				self.cmp = jQuery('<div id="layer-ctrl">' + html + '</div>');

        				self.cmp.find("span").each(function(){
        					jQuery(this).click(function(){
        						self._setLayer(parseInt(jQuery(this).attr('class')));
        					});
        				});

        				self.grp = L.layerGroup(layers);
        				self.grp.addTo(self.map);
        				self._setLayer(0);

        				return {
        					getCmp : function(index){
        						return self.cmp;
        					}
        				}
        			};

        			var ggl = new L.Google();
        			map.addLayer(ggl);

        			var ctrlLayer = new EuropeanaLayerControl(map,
        				[
        					{
        					    "title":	I18n.t('javascripts.leaflet.label.map_view'),
        					    "layer":	mq
        				    },
        				    {
        					    "title":	I18n.t('javascripts.leaflet.label.satellite_view'),
        					    "layer":	ggl
        				    }
        			    ]
        			);

        			europeanaCtrls.append(ctrlLayer.getCmp());

        			// Overview map - requires duplicate layer
        			//var osm2 = new L.TileLayer(osmUrl, {minZoom: 0, maxZoom: 13, attribution: osmAttrib });
        			new L.Control.MiniMap(
        				new L.TileLayer(
        					'http://otile{s}.mqcdn.com/tiles/1.0.0/{type}/{z}/{x}/{y}.png',
        					{
        						minZoom: 0,
        						maxZoom: 13,
        						attribution: mqTilesAttr,
        						subdomains: '1234',
        						type: 'osm'
        					}),
        				{toggleDisplay: true }
        			).addTo(map);
        			L.control.zoom().addTo(map);

        		}
        	}
        	recursiveLoad();

		}
	},


	truncate = {
		init : function() {
			if ( jQuery('#avatar').length < 1 ) {
				return;
			}

			jQuery('#story-metadata').truncate({
				limit : { pixels : 400 },
				toggle_html : {
					more : I18n.t('javascripts.truncate.show-more'),
					less : I18n.t('javascripts.truncate.show-less')
				}
			});
		}
	},


	tags = {
		init : function() {

			var form     = $('#add_tags_form');
			var tagInput = $('#tags');
			var token    = $('input[name=authenticity_token]').val();


			var writeTags = function(){

				tagInput.val('');

				// update tags display
				var pageUrl = window.location.href;
				pageUrl = pageUrl.indexOf('?') > -1 ? pageUrl.substr(0, pageUrl.indexOf('?')) : pageUrl;
					console.log('pageUrl: ' + pageUrl)
				$.ajax({
					url:  pageUrl + '/tags.json?ajax=true'
				}).done(function(res) {
					var panel = $('.tags-panel ul');
					if(!panel.length){
						$('#add_tags_form').before('<div class="panel tags-panel"><ul class="tags clearfix"></ul></div>');
						var panel = $('.tags-panel ul');
						console.log("CREATED a tags panel");
					}
					else{
						console.log("we have a tags panel");
					}
					console.log(JSON.stringify(res));
					panel.empty();
					$.each(res.tags, function(i, ob){
						console.log("prepare to append... " + JSON.stringify(ob)  );
						panel.append(	'<li>'
									+		'<a href="' + res.contrib_path.replace(/[0-9]/g, '') + 'tagged/' + ob + '">' + ob + '</a>'
									+		'<div class="action-links">'
									+			'<ul>'
									+				'<li>'
									+					'<a href="' + res.contrib_path + '/tags/' + ob + '/delete" data-confirm="' + res.tDelete + '" data-mathod="put" class="delete">' + res.tConfirm + '</a>'
									+				'</li>'
									+			'</ul>'
									+		'</div>'
									+	'<li>');
						console.log("done append" + i);
					});
				});
			}


			if (form.length) {
				// form submission
				form.submit(function(){

					$.ajax({
						type: "POST",
						url:  form.attr('action'),
						data: {"tags": tagInput.val(), "authenticity_token" : token }
					}).done(function() {
						writeTags();
					});
					return false;
				});

				// delete links

				$( ".tags-panel" ).on("click", "a.delete",
					function( e ) {
						e.stopPropagation();
						e.preventDefault();
						e = $(e.target);
						var tagName = e.closest('.action-links').prev('a').html();
						if( confirm( e.attr('data-confirm') )){
							$.ajax({
								type: "POST",
								url:  form.attr('action') + '/' + tagName,
								data: { "authenticity_token" : token, "_method" : "delete" }
							}).done(function() {
								writeTags();
							})

						}
				} );

			}
		}
	},


	mimetype = {
		$items: $('#institution-featured a'),
		itemsHandled: 0,
		itemsTotal: 0,

		ajax: {
			get: function( $elm ) {
				if ( $elm.attr('data-record') === undefined ) {
					mimetype.incrementItemsHandled();
					return;
				}

				$.ajax({
					complete: mimetype.incrementItemsHandled,
					success: function( data ) {
						mimetype.ajax.success( data, $elm );
					},
					timeout: 5000,
					type: 'GET',
					url: $elm.attr('data-record') + '/headers.json'
				});
			},

			success: function( data, $elm ) {
				if ( data['content-type'] && data['content-type'][0] && data['content-type'][0] === 'application/pdf' ) {
					mimetype.removeLightbox( $elm );
				}
			}
		},

		incrementItemsHandled: function() {
			mimetype.itemsHandled += 1;

			if ( mimetype.itemsHandled === mimetype.itemsTotal ) {
				lightbox.init();
			} else if ( mimetype.itemsHandled === 1 ) {
				lightbox.init();
				mimetype.ajax.get( mimetype.$items.eq( mimetype.itemsHandled ) );
			} else {
				mimetype.ajax.get( mimetype.$items.eq( mimetype.itemsHandled ) );
			}
		},

		init: function() {
			mimetype.itemsTotal = mimetype.$items.length;

			if ( mimetype.itemsTotal < 1 ) {
				return;
			}

			mimetype.ajax.get( mimetype.$items.eq( mimetype.itemsHandled ) );
		},

		removeLightbox: function( $elm ) {
			$elm
				.removeAttr( 'rel' )
				.attr( 'href', $elm.attr( 'data-record' ) + '?edmpdf=true' )
				.attr( 'target', '_blank' );
		}
	};


	(function() {

		truncate.init();
		RunCoCo.translation_services.init( jQuery('.translate-area') );
		carousels.init();
		map.init();
		tags.init();
		mimetype.init(); // lightbox is now initialized within this object

		//js.utils.initSearch();

		/*
		js.loader.loadScripts([{
			file : 'EuAccordionTabs.js',
			path : themePath + "javascripts/eu/europeana/",
			callback : function(){
				new AccordionTabs( $('#explore-further'),
					function(){
						console.log("tab change event");
					}
				);
			}
		}]);
		*/
	}());

}( jQuery ));
