(function( undefined ) {
	
	'use strict';
	
	
	function init() {
		
		jQuery('#explore-featured').rCarousel();
		jQuery('#explore-editors-picks').readMore({ read_more_link : '#read-more' });
		
		var $container = jQuery('#explore-featured-categories ol');
		$container.imagesLoaded(function() {
			$container.masonry({
				itemSelector : 'li',
				columnWidth : 93,
				isFitWidth : true,
				isAnimated : true
			});
		});
		
	}
	
	init();
	
}());