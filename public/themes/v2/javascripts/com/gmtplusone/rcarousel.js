/**
 *	@author dan entous <contact@gmtplusone.com>
 *	@version 2012-05-10 05:26 gmt +1
 */
(function() {

	'use strict';	
	
	if ( 'function' !== typeof Object.create ) {
		
		Object.create = function( obj ) {
			
			function F() {}
			F.prototype = obj;
			return new F();
			
		};
		
	}
	
	
	var RCarousel = {
		
		options : null,		
		$carousel_container : null,
		$carousel_ul : null,
		$items : null,
		$overlay : null,
		$prev : null,
		$next : null,
		
		carousel_container_width : 0,
		carousel_pages : 0,
		carousel_current_page : 0,
		
		item_width : 0,
		items_length : 0,
		items_total_width : 0,
		items_per_container : 0,
		
		current_item_index : 0,
		
		
		get : function( property ) {
			
			return this[property];
			
		},
		
		
		transition : function( coords ) {
			
			this.$carousel_ul.animate({
				'margin-left': coords || -( this.current_item_index * this.item_width )
			});
			
		},
		
		
		determinePage : function( current_item_index, items_per_container ) {
			
			var current_item = current_item_index + 1,
					nr_of_pgs = Math.ceil( this.items_length / items_per_container ),
					page_nr = Math.ceil( current_item / nr_of_pgs );
			
			return {
				nr_of_pgs : nr_of_pgs,
				page_nr : page_nr,
				page_first_item_index : ( page_nr * items_per_container ) - items_per_container
			};
			
		},
		
		
		goToIndex : function( index ) {
			
			this.current_item_index = index;
			this.transition();
			
		},
		
		
		setCurrentItemIndex : function( dir ) {
			
			var pos = this.current_item_index,
					previous_index = this.current_item_index;
			
			if ( !this.options.item_width_is_container_width ) {
				
				pos = dir === 'next' ? this.items_per_container : -1 * this.items_per_container;				
				
				this.current_item_index = this.current_item_index + pos;
				
				if ( this.current_item_index >= this.items_length ) { this.current_item_index = 0; }
				if ( this.current_item_index < 0 ) {
					
					if ( previous_index !== 0 ) {
						
						this.current_item_index = 0;
						
					} else {
						
						this.current_item_index = this.items_length - this.items_per_container;
						
					}
					
				}
				
			} else {
				
				pos += ( ~~( dir === 'next' ) || -1 );
				this.current_item_index = ( pos < 0 ) ? this.items_length - 1 : pos % this.item_width;
				if ( pos >= this.items_length ) { this.current_item_index = 0; }
				
			}
			
		},
		
		
		handleKeyUp : function( evt ) {
			
			if ( !evt || !evt.keyCode ) { return; }
			var self = evt.data.self;
			
			switch( evt.keyCode ) {
				
				case 37 :
					
					self.$prev.trigger('click');
					break;
				
				case 39 :
					
					self.$next.trigger('click');
					break;
				
			}
			
		},
		
		
		handleNavClick : function( evt ) {
			
			var self = evt.data.self,
					$elm = jQuery(this);
			
			
			self.setCurrentItemIndex( $elm.data('dir') );
			self.transition();
			
			if ( 'function' === typeof self.options.nav_callback ) {
				
				self.options.nav_callback.call(this);
				
			}
			
		},
		
		
		addNavigation : function() {
			
			var self = this;
			
			self.$carousel_container.append( self.$prev, self.$next );
			self.$prev.add( self.$next ).on( 'click', { self : self }, self.handleNavClick );
			
			// add keyboard arrow support
			if ( self.options.listen_to_arrow_keys ) {
				
				jQuery(document).bind('keyup', { self : self }, self.handleKeyUp );
				
			}
			
			// add touch swipe support
			// http://www.netcu.de/jquery-touchwipe-iphone-ipad-library
			if ( jQuery().touchwipe ) {
				
				self.$items.each(function() {
					
					var $elm = jQuery(this),
						$iframe = $elm.find('iframe');
					
					$elm.touchwipe({
						wipeLeft : function( evt ) { evt.preventDefault(); self.$next.trigger('click'); },
						wipeRight : function( evt ) { evt.preventDefault(); self.$prev.trigger('click'); },
						wipeUp : function( evt ) {},
						wipeDown : function( evt ) {}
					});
					
					if ( $iframe.length > 0 ) {
						
						$iframe.touchwipe({
							wipeLeft : function( evt ) { console.log('iframe left'); evt.preventDefault(); self.$next.trigger('click'); },
							wipeRight : function( evt ) { evt.preventDefault(); self.$prev.trigger('click'); },
							wipeUp : function( evt ) {},
							wipeDown : function( evt ) {}
						});
						
					}
					
				});
				
			}
			
		},
		
		
		getItemWidth : function() {
			
			var self = this,
					i,
					ii = self.items_length,
					width = 0;
			
			if ( self.options.item_width_is_container_width ) {
				
				return self.carousel_container_width;
				
			}
			
			for ( i = 0; i < ii; i += 1) {
				
				//if ( self.$items.eq(i).width() > width ) {
				if ( self.$items.eq(i).outerWidth(true) > width ) {
					
					//width = self.$items.eq(i).width();
					width = self.$items.eq(i).outerWidth(true);
					
				}
				
			}
			
			return width;
			
		},
		
		
		calculateDimmensions : function() {
			
			var self = this,
					pos = self.current_item_index === 0 ? 1 : self.current_item_index,
					new_margin_left = -( pos * self.item_width - self.item_width ),
					new_margin_right = '',
					page_info;
			
			
			self.items_length = self.$items.length;
			self.carousel_container_width = self.$carousel_container.width();
			self.item_width = self.getItemWidth();
			
			self.items_total_width = self.items_length * self.item_width;
			self.items_per_container = Math.floor( self.carousel_container_width / self.item_width );
			
			self.carousel_pages = Math.ceil( self.items_length / self.items_per_container );
			
			// needs to be called after items_length is determined
			page_info = self.determinePage( self.current_item_index, self.items_per_container );
			self.carousel_current_page = page_info.page_nr;
			
			
			if ( !self.options.item_width_is_container_width
					&& self.$items.length <= self.items_per_container ) {
				
				new_margin_left = 'auto';
				new_margin_right = 'auto';
				
			}
			
			self.$carousel_ul.css({
				width : self.items_total_width,
				'margin-left' : new_margin_left,
				'margin-right' : new_margin_right
			});
			
		},
		
		
		resizeItems : function( evt ) {
			
			var self = evt ? evt.data.self : this;
					self.calculateDimmensions();
			
			self.$items.each(function() {
				
				var $item = jQuery(this);
				$item.css('width', self.item_width );
				
			});
			
		},
		
		
		handleWindowResize : function( evt ) {
			
			var self = evt.data.self;
			self.resizeItems( evt );
			
			//var self = this,
			//		window_resize_timeout;
			//
			//jQuery(window).on(
			//	
			//	'resize',
			//	{ self : self },
			//	
			//	function(evt) {
			//		
			//		clearTimeout( window_resize_timeout );
			//		
			//		window_resize_timeout = setTimeout(
			//			
			//			function() {
			//				
			//					self.resizeItems( evt );
			//					self.goToIndex();
			//					
			//				
			//			},
			//			
			//			200
			//			
			//		);
			//		
			//	}
			//);
			
		},
		
		
		deriveCarouselElements : function( carousel_container ) {
			
			var self = this;
			self.carousel_container = carousel_container;
			self.$carousel_container = jQuery( carousel_container );
			self.$carousel_ul = self.$carousel_container.find('ul');
			self.$items = self.$carousel_container.find('li');
			self.$overlay = self.$carousel_container.find('.carousel-overlay');
			self.id = self.carousel_container.id;
			
		},
		
		
		createNavElements : function() {
			
			var self = this;
			
			self.$prev = jQuery('<input/>', {
				type : 'image',
				'class' : self.options.nav_button_size,
				alt : 'previous',
				src : '/themes/v2/images/icons/carousel-arrow-left.png',
				'data-dir' : 'prev'
			});
			
			self.$next = jQuery('<input/>', {
				type : 'image',
				'class' : self.options.nav_button_size,
				alt : 'next',
				src : '/themes/v2/images/icons/carousel-arrow-right.png',
				'data-dir' : 'next'
			});
			
		},
		
		
		init : function( options, carousel_container ) {
			
			var self = this;
			
			self.options = jQuery.extend( {}, jQuery.fn.rCarousel.options, options );
			self.createNavElements();
			self.deriveCarouselElements( carousel_container );
			self.resizeItems();
			jQuery(window).on( 'resize', { self : self }, self.handleWindowResize );			
			
			if ( self.options.item_width_is_container_width ) {
				
				if ( self.$items.length > 1 ) { self.addNavigation(); }
				
			} else {
				
				if ( self.$items.length > self.items_per_container ) { self.addNavigation(); }
				
			}
			
			self.$overlay.fadeOut();
			
		}
		
	};
	
	
	jQuery.fn.rCarousel = function( options ) {
		
		return this.each(function() {
			
			var rcarousel = Object.create( RCarousel );
			rcarousel.init( options, this );
			jQuery(this).data( 'rCarousel', rcarousel );
			
		});
		
	};
	
	
	jQuery.fn.rCarousel.options = {
		
		listen_to_arrow_keys : true,
		item_width_is_container_width : true,
		nav_button_size : 'medium',
		nav_callback : null
		
	};
	
	
}());