export const ARDMediathekAdapter = {

    publisher: 'ARD',

    /**
     * Get item by a publisher-specific ID.
     *
     * @param id The ID of the item
     * @return Item The item
     */
    readItemByID: async function (id) {

        const apiUrl = 'https://api.ardmediathek.de/page-gateway/pages/ard/item/' + id + '?embedded=false&mcV6=true';
        const apiDataJSON = await requestDataFromURL(apiUrl);
        if (!apiDataJSON) { throw `API responded with empty body (item id = ${id}, url = ${apiUrl})`; }

        const apiData = JSON.parse(apiDataJSON);
        if (!apiData?.widgets || !apiData?.widgets.length) {
            throw 'Unexpected API response (item id = ' + id + '): ' + JSON.stringify(apiData);
        }

        const widget = apiData.widgets[0];

        var item = {};
        item.id = id;
        item.publisher = this.publisher;
        item.originator = this.internal.optimizeContributor(widget.publicationService.name);
        item.title = widget.title || '';
        item.description = widget.synopsis || '';

        var mediaCollection = widget.mediaCollection || {};

        item.duration = mediaCollection?.embedded?.meta?.durationSeconds;

        var broadcasts = Date.parse(widget.broadcastedOn);
        if (broadcasts) {
            item.broadcasts = broadcasts / 1000;
        }

        var expires = Date.parse(widget.availableTo);
        if (expires) {
            item.expires = expires / 1000;
        }

        item.geoblocked = widget.geoblocked;
        item.language = 'de';
        item.webpageURL = 'https://www.ardmediathek.de/video/' + id;

        item.ratingInfo = widget.maturityContentRating;

        item.program = {};
        item.program.name = widget.show.title;
        item.program.id = widget.show.id;

        if (item.title.indexOf('(AD)') !== -1 || item.title.indexOf('Hörfassung') !== -1) {
            item.includesAudioDescription = true;
        }
        if (item.title.indexOf('Gebärden') !== -1) {
            item.includesSignLanguage = true;
        }

        this.internal.optimizeTitle(item);

        var image = {};
        image.description = widget.image.alt;
        image.copyright = widget.image.producerName;
        image.variants = this.internal.getImageVariants(widget.image.src, 'item');
        item.image = image;

        item.media = [];

        let mediaArray = mediaCollection?.embedded?.streams?.[0]?.media;
        if (Array.isArray(mediaArray)) {
            if (Array.isArray(mediaArray)) {
                for (var media of mediaArray) {

                    var info = {};
                    info.url = media.url;
                    info.type = media.mimeType;

                    const { maxHResolutionPx, maxVResolutionPx, isAdaptiveQualitySelectable } = media;
                    info.comment = maxHResolutionPx ? 'Resolution: ' + maxHResolutionPx + 'x' + maxVResolutionPx : (
                        isAdaptiveQualitySelectable ? 'Adaptive quality' : 'Unknown quality'
                    );

                    info.isHdr = media.isHighDynamicRange;

                    const downloadAllowed = info.url.indexOf('podcast') !== -1 || info.url.indexOf('//download.') !== -1 || info.url.indexOf('media.tagesschau.de') !== -1;

                    info.downloadAllowed = downloadAllowed
                    
                    if (downloadAllowed) { item.downloadAllowed = true; };

                    item.media.push(info);

                }
            }
        }

        item.subtitles = [];
        if (mediaCollection._subtitleUrl) {
            var subtitleObj = {
                format: 'ttml',
                language: 'de',
                url: mediaCollection._subtitleUrl
            };
            if (mediaCollection._subtitleOffset) {
                subtitleObj.offset = mediaCollection._subtitleOffset;
            }
            item.subtitles.push(subtitleObj);
        }

        return item;

    },


    /**
     * Get item by a webpage URL from this publisher.
     *
     * @param url The webpage URL of the item
     * @return object The item
     */
    readItemByPageURL: async function (url) {

        var urlInfo = parseURL(url);
        if (urlInfo.host != 'www.ardmediathek.de') {
            throw "Unexpected host, should be 'www.ardmediathek.de' but is " + urlInfo.host + ".";
        }

        let itemId = '';

        var pathParts = urlInfo.pathname.split('/');

        // expected path: /video/SENDUNG/FOLGE/SENDER/ID
        if (pathParts[1] == 'video') {
            itemId = pathParts[5];
        }
        else if (pathParts[1] == 'player') {
            // old URL scheme (2019)
            itemId = pathParts[4];
        }

        if (!itemId) {
            throw "Unexpected URL scheme, was expecting '/video/ID', got '" + urlInfo.pathname + "'.";
        }

        return this.readItemByID(itemId);

    },


    /**
     * Get metadata of a program
     *
     * @param ID The ID of the program
     * @return object The program
     */
    readProgram: async function (id) {

        var apiData = JSON.parse(await requestDataFromURL('https://api.ardmediathek.de/page-gateway/pages/ard/grouping/' + id + '?embedded=false&seasoned=true'));

        if (!apiData?.title) { throw 'Unexpected response from server: ' + JSON.stringify(apiData); }

        var program = {};
        program.name = apiData.title;
        program.id = id;
        program.publisher = ARDMediathekAdapter.publisher;
        program.originator = ARDMediathekAdapter.internal.optimizeContributor(apiData.publicationService?.name);
        program.description = apiData.synopsis;
        program.language = 'de';
        program.homepage = apiData.links?.homepage?.href;
        program.image = ARDMediathekAdapter.internal.getImageVariants(apiData.images || apiData.image?.src, 'program');
        return program;

    },


    /**
     * Returns a token that contains information on how to obtain a feed for a program.
     *
     * @param programID The ID of the program
     * @return string The token
     */
    feedDescriptorForProgram: function (programID) {
        return { programID: programID };
    },


    /**
     * Get a program's feed
     *
     * @param feedInfo A token that contains the ID of the program
     * @return array A list of item descriptors (itemID, title, description, ...)
     */
    readProgramFeed: async function (feedInfo) {

        var id = feedInfo.programID;

        const apiUrl = 'https://api.ardmediathek.de/page-gateway/widgets/ard/asset/' + id + '?pageNumber=0&pageSize=12'
        const apiDataJSON = await requestDataFromURL(apiUrl);
        const apiData = JSON.parse(apiDataJSON);

        const teasers = apiData?.teasers;
        if (!Array.isArray(teasers)) {
            throw 'Unexpected response from ARD API: ' + JSON.stringify(apiData);
        }

        const descriptors = [];
        for (var teaser of teasers) {

            const descriptor = {
                id: teaser.id,
                title: teaser.longTitle,
                duration: teaser.duration,
                publisher: this.publisher
            };

            if (teaser.broadcastedOn) {
                descriptor.broadcasts = +new Date(teaser.broadcastedOn) / 1000;
            }

            if (teaser.images && teaser.images['aspect16x9']) {
                descriptor.image = {
                    variants: [
                        ARDMediathekAdapter.internal.createImageVariantFromTemplate(teaser.images['aspect16x9']['src'], 256, 144)
                    ]
                };
            }

            this.internal.optimizeTitle(descriptor);

            descriptors.push(descriptor);
        }

        return descriptors;
    },


    /**
     * Get all available programs from this publisher
     */
    readListOfPrograms: async function () {

        const pageIds = {
            a: 'QVJELmE',
            b: 'QVJELmI',
            c: 'QVJELmM',
            d: 'QVJELmQ',
            e: 'QVJELmU',
            f: 'QVJELmY',
            g: 'QVJELmc',
            h: 'QVJELmg',
            i: 'QVJELmk',
            j: 'QVJELmo',
            k: 'QVJELms',
            l: 'QVJELmw',
            m: 'QVJELm0',
            n: 'QVJELm4',
            o: 'QVJELm8',
            p: 'QVJELnA',
            q: 'QVJELnE',
            r: 'QVJELnI',
            s: 'QVJELnM',
            t: 'QVJELnQ',
            u: 'QVJELnU',
            v: 'QVJELnY',
            w: 'QVJELnc',
            x: 'QVJELng',
            y: 'QVJELnk',
            z: 'QVJELno',
            '#': 'QVJELiM'
        }


        var programs = [];

        const pageSize = 100;
        for (var key in pageIds) {
            const pageId = pageIds[key];
            let pageIndex = 0;
            let totalPages = 1;
            do {
                console.log(`Fetching page ${pageIndex + 1} of programs for key '${key}' (${pageId})...`);
                const apiUrl = `https://api.ardmediathek.de/page-gateway/widgets/ard/editorials/${pageId}?pageSize=${pageSize}&pageNumber=${pageIndex}`;
                const apiDataJSON = await requestDataFromURL(apiUrl);
                const apiData = JSON.parse(apiDataJSON);
                const totalElements = apiData.pagination?.totalElements || 0;

                if (!totalElements) {
                    throw 'Unexpected response from ARD API: ' + JSON.stringify(apiData);
                }

                totalPages = Math.ceil(totalElements / pageSize);

                for (const teaser of apiData.teasers) {

                    var program = {};
                    program.name = teaser.longTitle || teaser.mediumTitle;
                    program.id = teaser.links?.target?.id;
                    program.publisher = ARDMediathekAdapter.publisher;
                    program.originator = ARDMediathekAdapter.internal.optimizeContributor(teaser.publicationService?.name);
                    program.language = 'de';
                    program.image = ARDMediathekAdapter.internal.getImageVariants(teaser.images || teaser.image?.src, 'program');

                    programs.push(program);
                }

                //break; //Test
                pageIndex++;
            }
            while (pageIndex < totalPages);
            //break; //Test
        }

        console.log(`Found ${programs.length} programs for publisher '${this.publisher}'`);

        return programs;

    },

    /**
     * Returns a item ID to run a test on the adapter.
     *
     * @return String
     */
    adapterTestItemID: async function () {

        if (!this.adapterTestItemIDValue.length) {

            // Get item from website
            var html_data = await requestDataFromURL('http://www.ardmediathek.de/');
            var pos = html_data.indexOf('/ard/player/');
            if (pos === -1) throw 'Failed to extract item id in ARDMediathekAdapter::adapterTestItemID().';
            pos += '/ard/player/'.length;
            var pos2 = html_data.indexOf('/', pos);
            var id = html_data.substr(pos, pos2 - pos);

            this.adapterTestItemIDValue = id;

        }

        return this.adapterTestItemIDValue;
    },


    /**
     * Returns a program ID to run a test on the adapter.
     *
     * @return String
     */
    adapterTestProgramID: function () {
        // Tagesschau
        return 'Y3JpZDovL2Rhc2Vyc3RlLmRlL3RhZ2Vzc2NoYXU';
    },

    internal: {


        /**
         * Gets the average (measured) bitrates for the different quality values from ARD.
         *
         * @return Int
         */
        avgBitrateForQuality: function (q) {
            var bitrate = 0;
            if (q === '0') bitrate = 180;
            if (q === '1') bitrate = 600;
            if (q === '2') bitrate = 1200;
            if (q === '3') bitrate = 2000;
            return bitrate;
        },


        /**
         * Optimizes the title for display.
         *
         * @return String
         */
        optimizeTitle: function (item) {

            if (item.broadcasts &&
                item.title == 'tagesthemen') {
                var date = new Date(item.broadcasts * 1000);
                item.title = item.title + ' vom ' + date.getDate() + '.' + (date.getMonth() + 1) + '.' + date.getFullYear();

            }

            if (item.title.indexOf('Die Sendung vom') === 0 && item.program.name) {
                item.title = item.program.name + ' vom';
            }

        },


        // /**
        //  * Calls the API.
        //  *
        //  * @param variables Variables to send with the request
        //  * @param sha256Hash A precomputed hash
        //  * @return Object The parsed response.
        //  */
        // call2019API: async function (variables, sha256Hash) {

        //     var extensions = { "persistedQuery": { "version": 1, "sha256Hash": sha256Hash } };

        //     var apiURL = 'https://api.ardmediathek.de/public-gateway?variables=' + encodeURIComponent(JSON.stringify(variables)) + '&extensions=' + encodeURIComponent(JSON.stringify(extensions));

        //     var apiDataRaw = await requestDataFromURL(apiURL);
        //     var apiData = JSON.parse(apiDataRaw);

        //     if (!apiDataRaw || !apiData) {
        //         throw 'Could not call API.';
        //     }
        //     if (apiData.error) {
        //         throw 'API responded with error: ' + JSON.stringify(apiData);
        //     }

        //     return apiData;

        // },


        /**
         * Creates a single image variant
         *
         * @return Object
         */
        createImageVariantFromTemplate: function (imageURLTemplate, width, height) {
            var variant = {};
            variant.url = imageURLTemplate.replace('{width}', width);
            variant.width = width;
            variant.height = height;
            return variant;
        },

        /**
         * Creates all image variants
         *
         * @return Array
         */
        getImageVariants: function (imageURLTemplateOrDict, type) {

            const itemWidths = [1984, 1024, 640, 256];
            const programWidths = [320, 768];

            if (typeof imageURLTemplateOrDict === 'string') {
                var imageURLTemplate = imageURLTemplateOrDict;
                const aspectRatio = 16 / 9; // Default aspect ratio
                if (type == 'item') {
                    return itemWidths.map(width => ARDMediathekAdapter.internal.createImageVariantFromTemplate(imageURLTemplate, width, Math.round(width / aspectRatio)));
                } else if (type == 'program') {
                    return programWidths.map(width => ARDMediathekAdapter.internal.createImageVariantFromTemplate(imageURLTemplate, width, Math.round(width / aspectRatio)));
                }
            }
            else if (typeof imageURLTemplateOrDict === 'object') {
                const variants = [];
                for (const key in imageURLTemplateOrDict) {
                    if (!key.startsWith('aspect')) {
                        continue; // Skip keys that do not start with 'aspect'
                    }
                    const splitKey = key.substring(6).split('x');
                    if (splitKey.length !== 2 || !isFinite(splitKey[0]) || !isFinite(splitKey[1])) {
                        continue; // Skip keys that do not match the expected format
                    }
                    const aspectRatio = parseFloat(splitKey[0]) / parseFloat(splitKey[1]);
                    if (isNaN(aspectRatio) || aspectRatio <= 0) {
                        continue; // Skip invalid aspect ratios
                    }

                    if (type == 'item') {
                        itemWidths.forEach(width => {
                            variants.push(ARDMediathekAdapter.internal.createImageVariantFromTemplate(imageURLTemplateOrDict[key].src, width, Math.round(width / aspectRatio)));
                        })
                    }
                    else if (type == 'program') {
                        programWidths.forEach(width => {
                            variants.push(ARDMediathekAdapter.internal.createImageVariantFromTemplate(imageURLTemplateOrDict[key].src, width, Math.round(width / aspectRatio)));
                        })
                    }

                }
                return variants;
            }
        },


        optimizeContributor: function (originator) {
            if (!originator) { return; }
            // Drop 'Fernsehen'
            originator = originator.replace(' Fernsehen', '');
            // Trim region (SWR Baden-Württemberg --> SWR)
            if (originator.indexOf('SWR ') == 0 || originator.indexOf('MDR ') == 0) {
                return originator.substr(0, 3);
            }
            if (originator == 'mdr.de') { return 'MDR'; }
            if (originator == 'swr.de') { return 'SWR'; }
            if (originator == 'hr-fernsehen') { return 'hr'; }
            if (originator == 'Radio Bremen TV') { return 'Radio Bremen'; }
            return originator;
        },

    },


};
