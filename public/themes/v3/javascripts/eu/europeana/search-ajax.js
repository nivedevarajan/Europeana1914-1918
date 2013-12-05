/**
 * Andy MacLean
 * 
 * Allows data provided by the portal to be navigated without page reloads.
 * 
 * 
 * TODO:
 * 
 * refine form 
 * 
 * 
 * */

EUSearchAjax = function(){
	
    var self                    = this;
    var container               = false;
    var itemTemplate            = false;
    var facetTemplate           = false;
    var facetless               = false;
    var resultServerUrl         = 'http://europeana.eu/portal';
    var searchUrl				= searchUrl ? searchUrl : '/europeana/search.json';
    var defaultRows             = 6;
    var pagination              = false;
    var paginationData          = typeof defPaginationData != 'undefined' ? defPaginationData : {};
    
   
    var doSearch = function(startParam, query){	
    	showSpinner();
    	try{
	    	var url = buildUrl(startParam, query);
	
	        if(typeof url != 'undefined' && url.length){
	        	
	        	if(searchUrl.indexOf('file')==0){
					getFake();
	        	}
	        	else{
	                $.ajax({
	                    "url" : url,
	                    "type" : "GET",
	                    "crossDomain" : true,
	                    "dataType" : "script",
	                    "contentType" :	"application/x-www-form-urlencoded;charset=UTF-8"
	                });
	        	}
	
	        }
	        else{
	            self.q.addClass('error-border');
	        }
    	}
    	catch(e){
        	hideSpinner();
    		console.log(e);
    	}
    };

    
    // build search param from url-fragment hrefs.  @startParam set to 1 if not specified
    /**
     * 
     * used to be:
     * 
     * &facets[TYPE]=IMAGE,VIDEO
     * 
     * is now the weirder looking:
     * 
     * &facets[TYPE][]=IMAGE&facets[TYPE][]=VIDEO
     */
    var buildUrl = function(startParam, query){

    	//return "http://localhost:3000/en/europeana/search.json?q=tank&profile=facets,params&callback=searchAjax.showRes&count=12&facets[TYPE][]=IMAGE&facets[TYPE][]=VIDEO&page=2"
    	console.log("buildUrl() @startParam= " + startParam + ", @query = " + query);
    	
        var term = self.q.val();
        if (!term) {
            return '';
        }
        
        var url = '';
		var param = function(urlIn){
			return ((urlIn ? urlIn : url).indexOf('?')>-1) ? '&' : '?';
		};

		
		var rows = parseInt(self.resMenu1.getActive() ? self.resMenu1.getActive() : defaultRows);
    	
		url = query ? searchUrl + param(searchUrl) + query : searchUrl + param(searchUrl) + 'q=' + term;        	
    	url += "&profile=facets,params&callback=searchAjax.showRes";
    	url += '&count='  + rows;
    	url += '&start=' + (startParam ? startParam : 1);
    	url += '&page='  + (startParam ? Math.ceil(startParam / rows) : 1);
         

    	var facetParams = {};
    	var newFacetParamString = '';
    
    	if(facetless){
    		facetless = false; // we've just switched provider
    	}
    	else{
	        container.find('#facets input:checked').each(function(i, ob){
	        	var urlFragment = $(ob).next('a').data('value');
	        	if(typeof(urlFragment) != 'undefined'){
	        		newFacetParamString += urlFragment;
	        	}
	        });	       
	        url += newFacetParamString;
    	}
    
		console.log('final search url: ' + url);
		return url;
    };

    // binds facet links to the doSearch function
    var bindFacetLinks = function(){
    	
    	container.find('#facets ul li input[type="checkbox"]').each(function(i, ob){
    		
            ob = $(ob);
            
            // address firefox caching of checked state following reload
            
            if(ob.prop('checked') == true){
            	if(ob.attr('checked') != 'checked'){
            		ob.prop('checked', false);
            		console.log('corrected cb');
            	}
            }
            
    		ob.attr({
                "name"  : "cb-" + i,
                "id"    : "cb-" + i
            });
    		
    		// add "for" attribute to label and "remove" image - this for checkbox interoperability
            ob.next('a').find('label').attr('for', "cb-" + i).parent().next('a').find('img').attr('for', "cb-" + i);
    	});
    	
        
    	var refinements = container.find('#refine-search-form');
    	
    	container.find('#facets ul li a img').add(container.find('#facets ul li input')).not("#newKeyword").not('input[type="submit"]').click(function(e){
    		
    		//alert('input click');
    		
    		var cb = $(e.target);
    		
    		if(cb.attr("for")){
    			if(e.target.nodeName.toUpperCase()=='IMG'){
                    e.preventDefault();
                    container.find('#facets #' + cb.attr("for")).click();
    			}
    		}
    		else{
    			// build hidden input based on href of next link element (TODO - fix brittle design) - this keeps the facets intact when a refinement is submitted via the form
    			// question: couldn't we just ajaxify the refinement form???
    			
    			var href = cb.next('a').attr('href');
    			if(cb.prop('checked')){
    				$('<input type="hidden" name="qf" value="' + href + '"/>').appendTo(refinements);
    			}
    			else{
    				var toRemove =  refinements.find('input[value="' + href + '"]');
    				toRemove.remove();
    			}
    			doSearch();
    		}
    	});
    };


    /* 
     * callback from API call
     * 
     * */
    var showRes = function(data){

    	console.log("showRes()");
    	
        // Append items
        var grid = container.find('.section.active .stories');
        grid.empty();

        var start = data.params.start ? data.params.start : 1;

        // @richard - we need a start value.
        
        // write items to grid
                
        $(data.items).each(function(i, ob){
        	
            var item = itemTemplate.clone();

            item.find('a').attr({
            	'href': resultServerUrl + '/record' + ob.id + '.html?start=' + start + '&query=',
            	'title': ob.title
            });

            item.find('.story-title').html(
            	document.createTextNode(ob.title)
            );
                        
            
            var providerFieldHtml = '';
            $.each(['dctermsAlternative', 'dataProvider', 'provider'], function(i, providerField){
            	if(ob[providerField] && ob[providerField].length){
            		providerFieldHtml += '<span class="story-provider">' + ob[providerField] + '</span>';
            	}
            });
            if(providerFieldHtml.length){
            	var existingProviders = item.find('.story-provider');
            	existingProviders.addClass('expired');
            	item.find('.story-title').after(providerFieldHtml);
            	$('.expired').remove();
            }

            
            
            /*
            item.find('a .ellipsis').prepend(
                document.createTextNode(ob.title)
            );

            item.find('.thumb-frame a').attr({
                "title": ob.title,
                "target" : "_new"
            });
            */
            if(ob.edmPreview){
	            item.find('img').attr(
	                'src', ob.edmPreview[0]
	            );
            }
            
            grid.append(item);
        });


        // pagination
      
        paginationData = {"records":data.totalResults, "rows": data.params.rows, "start": start};
        
        pagination.setData(data.totalResults, data.params.rows, start);


        // result stats

        container.find('.first-vis-record').html(start);
        container.find('.last-vis-record') .html(start - 1 + data.itemsCount);
        container.find('.last-record')     .html(data.totalResults);


        // facets
        
        var facetOrder = ['UGC','LANGUAGE','TYPE','YEAR','PROVIDER','DATA_PROVIDER','COUNTRY','RIGHTS','REUSABILITY'];
        data.facets.sort(function(a, b) {
			var res = $.inArray(a.label, facetOrder) - $.inArray(b.label, facetOrder);
			return res > 0 ? 1 : res < 0 ? -1 : 0;
		});
        
        EUSearch.resetOpenedFacets();
        var selected = EUSearch.findSelectedFacetOps(true);
        
        //container.find('#facets>li').not(":nth-child(1)").not(":nth-child(2)").remove(); // remove all but the "Add Keyword" refinement form and provider radios.
        container.find('#facets>li').not(":nth-child(1)").remove(); // remove all but the "Add Keyword" refinement form
        
        // write facet dom

        $(data.facets).each(function(i, ob){
        	
            var facet           = facetTemplate.clone();
            var facetOps        = facet.find('ul');
            var facetOpTemplate = facetOps.find('li:nth-child(1)');
                        
            facet.find('h3 a').html(capitalise(ob.name));
            
            facetOps.empty();
            
            var selFacetOpLink = 'h4 a';
            var selFacetLabel  = 'label';
            
            $.each(ob.fields, function(i, field){
                
                var facetOp     = facetOpTemplate.clone();
                //var urlFragment = "&facets[" + ob.name + "]=" + field.label;
                var urlFragment = '&qf[]=' + ob.name + ':' + field.label;
                                               
                facetOp.find(selFacetOpLink).attr({
                    "data-value"  : urlFragment,
                    "title" : field.label
                });

                facetOp.find(selFacetLabel).html(field.label).attr({
                    "title" : field.label
                });

                facetOps.append( facetOp );

                if( $.inArray( facetOp.find(selFacetOpLink).data('value'), selected) == -1 ){
                	facetOp.find('.fcount').html(' (' + field.count + ')');
                }
                else{
                	facetOp.find('.fcount').remove();
                	facetOp.find(selFacetLabel).addClass('bold');                	
                }
                
            });
            facet.append(facetOps);
            container.find('#facets').append(facet);
        });

        
        // facet collapsibility               
        
        container.find('#facets>li:not(:first)').each(function(i, ob){
        	ob = $(ob);
        	var heading = ob.find('h3 a');
			createCollapsibleSection(ob, function(){
	            return heading.parent().next('ul').first().find('a');   
	        },
	        heading);
        });

        hideSpinner();
        
        // restore facet selection
    

        // TODO: language compatibility

        var labelRemove = 'Remove';
        
        //var opened = {};

        $(selected).each(function(i, ob){
            var object = container.find('a[data-value="' + ob + '"]');
            object.attr('href', '');
            object.after(' <a title="' + labelRemove + '" href="" data-value=""><img src="/images/style/icons/cancel.png" alt="Remove"/></a>');
            EUSearch.openFacet(object);
            object.prev().prop('checked', true);
        });

        // facet actions 

        bindFacetLinks();
                

        // open "Add Keyword"
        //alert('open add keyword');
        if(container.find('#refinements').css('display') == 'none'){
        	container.find('#facets li:first h3 a').click();
        }
        //alert('opened add keyword');


    }; // end showRes

    
    var showSpinner = function(){
    	$('.ajax-overlay').attr('style', 'top:' + $(window).scrollTop() + 'px');
    	$('.ajax-overlay').show();
    };
    
    var hideSpinner = function(){
    	$('.ajax-overlay').hide();
    };
    
    var capitalise = function(str){
    	return (str.substr(0,1).toUpperCase() + str.substr(1).toLowerCase() ).replace(/_/g, ' ');
    };
    
	var createCollapsibleSection = function(ob, fnGetItems, heading){
        var accessibility =  new EuAccessibility(heading, fnGetItems);
        
        if(ob.hasClass('ugc-li')){
            ob.bind('keypress', accessibility.keyPress);
        }
        else{
            ob.Collapsible({
                "headingSelector" : "h3 a",
                "bodySelector"    : "ul",
                "keyHandler"      : accessibility
            });
        }
    };

    var setupQuery = function(){
        self.q = container.find('.jump-to-page:first #q');
      
        var submitCell          = container.find('.submit-cell');
        var submitCellButton    = container.find('button');
        var menuCell            = container.find('.menu-cell');
        var searchMenu          = container.find('#search-menu');

        // form size adjust
        submitCell.css("width", submitCellButton.outerWidth(true) + "px"); 
        menuCell.css("width", searchMenu.width() + "px");
        submitCellButton.css("border-left",    "solid 1px #4C7ECF");    // do this after the resize to stop 1px gap in FF

        // Disable forms and wire submission to ajax call
        
        
        container.find("form").submit(function() {
            doSearch();
            return false;
        });
        
        container.find("#refine-search-form").unbind('submit').submit(function() {
        	//alert('submit');
	        try{	
	        	var keyInput = $(this).find('#newKeyword');
	        	var keyword  = keyInput.val();
	        	
	        	keyInput.val('');
	        	if(keyword){
	        		keyInput.removeClass('error-border');    		
		     		$(this).append('<input type="hidden" name="qf" value="qf=' + keyword + '"/>');
	                doSearch();    
	        	}
	        	else{
	        		keyInput.addClass('error-border');
	        	}
	        }
	        catch(e){
	        	console.log(e);
	        }
            return false;
        });
    };

    var setupMenus = function(){
    	
        // result size 
        
    	var menuConfig = {
            "fn_init": function(self){
                self.setActive(paginationData.rows);
            },
            "fn_item":function(self, selected){
                doSearch(paginationData.start);
            }
        };
    	
        self.resMenu1 = new EuMenu( container.find(".nav-top .eu-menu"),	menuConfig);
        self.resMenu2 = new EuMenu( container.find(".nav-bottom .eu-menu"),	menuConfig);

        self.resMenu1.init();
        self.resMenu2.init();

        // menu closing
        $(container).click( function(){
        	container.find('.eu-menu' ).removeClass("active");
        });
    };

   
    
    
    
    self.init = function() {

        container = $('#content');
        
        $('body').append('<div class="ajax-overlay"></div>');
        $('.ajax-overlay').hide();
        
        itemTemplate       = container.find('.stories li:first');
        facetTemplate      = $(
        '<li>' + 
          '<h3><a rel="nofollow" class="facet-section icon-arrow-6" href=""></a></h3>' + 
          '<ul style="display: none;">' +
            '<li>' + 
              '<h4>' + 
                  '<input type="checkbox"><a><label></label></a><span class="fcount"></span>' + 
              '</h4>' + 
            '</li>' + 
          '</ul>' + 
        '</li>'
        );

        setupQuery();
        setupMenus();

        bindFacetLinks();
        
        // do last
        pagination = new EuPagination($('.result-pagination'),
        	{
        		"ajax":true,
        		"fns":{
            		"fnFirst":function(e){
            			e.preventDefault();
            			searchAjax.search(1);
            		},
					"fnPrevious":function(e){
						e.preventDefault();
						searchAjax.search(paginationData.start - paginationData.rows);
					},       			
            		"fnNext":function(e){
            			e.preventDefault();
            			searchAjax.search( parseInt(paginationData.start) + parseInt(paginationData.rows));
            		},
					"fnLast":function(e){
						e.preventDefault();
						searchAjax.search(pagination.getMaxStart());
					},
            		"fnSubmit":function(val){
						val = parseInt(val);
            			var start = ((val-1) * paginationData.rows) + 1;
            			searchAjax.search( start );            				
			            return false;
					}
        		},
        		data: paginationData
        	}
        );

    };

    
    return {
        "init" : function(data){ self.init();},
        "search" : function(startParam){ doSearch(startParam); },
        "showRes" : function(data){ showRes(data); },
        "setSearchUrl" : function(urlStem){
            searchUrl = '/' + urlStem + '/search.json';
            facetless = true; // next call only will be without facets
        }
    };
    
};



var searchAjax = EUSearchAjax();
searchAjax.init();

