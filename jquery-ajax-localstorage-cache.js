/* global Storage */
/**
 * https://github.com/SaneMethod/jquery-ajax-localstorage-cache
 */
; (function($, window, document, Storage, undefined) {
    /**
     * Generate the cache key under which to store the local data - either the cache key supplied,
     * or one generated from the url, the type and, if present, the data
     */
    var getCacheKey = function(options) {

            var url = options.url.replace(/jQuery.*/i, '');

            // Strip _={timestamp}, if cache is set to false
            if (options.cache === false) {

                // Regex found in ajax.js
                url = url.replace(/([?&])_=[^&]*/, '');

            }

            return options.cacheKey || url + options.type + (options.data || '');

        },

        // Is a valid storage object that can be used
        isStorage = function(storage) {

            // The functions that are required for this plugin
            return typeof storage === 'object' && 'getItem' in storage && 'removeItem' in storage && 'setItem' in storage;

        };

    /**
     * Prefilter for caching ajax calls
     * See also $.ajaxTransport for the elements that make this compatible with jQuery Deferred.
     * New parameters available on the ajax call:
     * localCache   : true // required - either a boolean (in which case localStorage is used), or an object
     *                implementing the Storage interface, in which case that object is used instead.
     * cacheTTL     : 5,        // optional - Cache time in minutes, default is 60 (1 hour)
     * cacheKey     : 'post',   // optional - Key under which cached string will be stored
     * isCacheValid : function  // optional - Function that should return either true (valid) or false (invalid)
     * @method $.ajaxPrefilter
     * @param options {Object} Options for the ajax call, modified with ajax standard settings
     */
    $.ajaxPrefilter(function(options) {

        // If not defined (even though it should be) consider that the user has included the function on each page
        // for convenience
        if (typeof options.localCache === 'undefined') {
            return;
        }

        var storage = (options.localCache === true) ? window.localStorage : options.localCache;

        // Check if the storage is valid
        if (!isStorage(storage)) {

            console.log('Ajax Local Storage [Storage Error]: The local cache option is not a valid Storage object');
            return;

        }

        // Get the cache key based on the ajax options
        var cacheKey = getCacheKey(options),

            // Function to check if the storage data is valid
            isCacheValid = options.isCacheValid;

        if (isCacheValid && typeof isCacheValid === 'function' && isCacheValid() === false) {

            storage.removeItem(cacheKey);
            console.log('Ajax Local Storage: Removing "' + cacheKey + '" from the storage');

        }

        // Constant for the cache post-fix
        var CACHE_TTL_PREFIX = '_cachettl',

            // Parse the cache 'Time To Live' as an number from storage
            ttl = parseInt(storage.getItem(cacheKey + CACHE_TTL_PREFIX));

        // Check if ttl is a valid integer
        if (isNaN(ttl)) {

            ttl = 0;

        }

        if (ttl && ttl < +new Date()) { // Or new Date().valueOf()

            storage.removeItem(cacheKey);
            storage.removeItem(cacheKey + CACHE_TTL_PREFIX);
            ttl = 0;
            console.log('Ajax Local Storage: Removing "' + cacheKey + '" and ' + '"' + cacheKey + '_cachettl" from the storage');

        }

        if (!storage.getItem(cacheKey)) {
            // If it not in the cache, store the data, add success callback - normal callback will proceed
            if (options.success) {

                options.realsuccess = options.success;

            }

            options.success = function(data) {
                var response = data;
                if (this.dataType.toUpperCase().indexOf('JSON') === 0) {

                    response = JSON.stringify(data);
                    console.log('Ajax Local Storage: Stringifying to json');

                }

                // Save the data to storage catching exceptions (possibly QUOTA_EXCEEDED_ERR)
                try {

                    storage.setItem(cacheKey, response);

                } catch (e) {

                    // Remove any incomplete data that may have been saved before the exception was caught
                    storage.removeItem(cacheKey);
                    storage.removeItem(cacheKey + CACHE_TTL_PREFIX);
                    console.log('Ajax Local Storage [Cache Error]:' + e, cacheKey, response);

                }

                if (options.realsuccess) {

                    options.realsuccess(data);

                }
            };

            // Store timestamp
            if (ttl === 0) {

                // 60000 is the same as 1000 * 60, which is basically 1 minute
                storage.setItem(cacheKey + CACHE_TTL_PREFIX, +new Date() + 60000 * (options.cacheTTL > 0 ? options.cacheTTL : 60));

            }
        } else {

            console.log('Ajax Local Storage: It appears the data is already cached in storage');

        }

    });

    /**
     * This function performs the fetch from cache portion of the functionality needed to cache ajax
     * calls and still fulfil the jqXHR Deferred Promise interface
     * See also $.ajaxPrefilter
     * @method $.ajaxTransport
     * @params options {Object} Options for the ajax call, modified with ajax standard settings
     */
    $.ajaxTransport('+*', function(options) {

        if (typeof options.localCache !== 'undefined' && options.localCache) {

            var storage = (options.localCache === true) ? window.localStorage : options.localCache;

            // Check if the storage is valid
            if (!isStorage(storage)) {

                console.log('Ajax Local Storage [Storage Error]: The local cache option is not a valid Storage object');
                return;

            }

            // Get the cache key based on the ajax options
            var cacheKey = getCacheKey(options),

                // Get the value from storage
                value = storage.getItem(cacheKey);

            if (value) {
                // In the cache? Get it, parse it to json if the dataType is json,
                // and call the completeCallback with the fetched value.
                if (options.dataType.toUpperCase().indexOf('JSON') === 0) {

                    console.log('Ajax Local Storage: Parsing as json');
                    value = JSON.parse(value);

                }

                return {
                    send: function(headers, completeCallback) {
                        console.log('Ajax Local Storage: Sending to complete callback function');
                        var response = {};
                        response[options.dataType] = value;
                        completeCallback(200, 'success', response, '');
                    },
                    abort: function() {
                        console.log('Ajax Local Storage [Error]: Aborted ajax transport for json cache');
                    }
                };
            }
        }

    });
})(jQuery, window, document, Storage);