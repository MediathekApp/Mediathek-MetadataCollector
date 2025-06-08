export const ArteTvAdapter = {

    publisher: 'Arte',

    /**
     * Get item by a publisher-specific ID.
     *
     * @param id The ID of the item
     * @return Item The item
     */
    readItemByID: async function (id) {

        // Example IDs: 085746-048-A_de, 085746-048-A

        // Determine the language code (de or fr)
        var language;
        {
            var split = id.split('_');
            if (split.length == 2) {
                id = split[0];
                language = split[1];
            }
            else {
                language = 'de';
            }
        }

        var apiURL = 'https://api.arte.tv/api/player/v2/config/' + language + '/' + id;
        var responseObject = await this.internal.call2019API(apiURL, id);

        if (!responseObject || !responseObject.data) {
            throw 'Unexpected response from API: ' + JSON.stringify(responseObject);
        }

        var item = {};
        item.id = responseObject.data.id;
        item.publisher = this.publisher;
        item.originator = responseObject.data.attributes.provider;
        item.title = responseObject.data.attributes.metadata.title;
        item.subtitle = responseObject.data.attributes.metadata.subtitle || '';
        item.description = responseObject.data.attributes.metadata.description || '';
        item.duration = responseObject.data.attributes.metadata.duration.seconds;

        if (item.title.indexOf('(AD)') !== -1 || item.title.indexOf('Hörfassung') !== -1) {
            item.includesAudioDescription = true;
        }
        if (item.title.indexOf('Gebärden') !== -1) {
            item.includesSignLanguage = true;
        }


        if (responseObject.data.attributes.rights) {
            // broadcasts
            var broadcasts = Date.parse(responseObject.data.attributes.rights.begin);
            if (broadcasts) {
                item.broadcasts = broadcasts / 1000;
            }

            // expires
            var expires = Date.parse(responseObject.data.attributes.rights.end);
            if (expires) {
                item.expires = expires / 1000;
            }
        }

        var restriction = responseObject.data.attributes.restriction;
        if (restriction) {
            if (restriction.geoblocking && restriction.geoblocking.code != 'ALL') {
                item.geoblocked = true;
            }
        }
        else {
            item.geoblocked = false;
        }

        item.language = responseObject.data.attributes.metadata.language;

        if (restriction) {
            item.ratingInfo = restriction.ageRestriction;
        }

        item.webpageURL = 'https://www.arte.tv/' + item.language + '/videos/' + item.id + '/';

        const associatedCollections = responseObject.data.attributes.stat?.push?.associatedCollections;
        if (Array.isArray(associatedCollections)) {
            const programID = associatedCollections[0];
            if (programID.length == 9) {
                item.program = {};
                item.program.id = programID + '_' + item.language;
                item.program.name = await this.internal.nameForProgramID(programID, language);
            }
        }

        item.image = {};
        item.image.variants = [];
        for (var imgData of responseObject.data.attributes.metadata.images) {

            var variant = {};
            variant.url = imgData.url;

            if (imgData.caption) {
                item.image.description = imgData.caption;
            }

            // Identifying size.
            // We're looking for a path component like '940x530'.
            var parts = imgData.url.split('/');
            for (var part of parts) {
                if (isFinite(part[0])) {
                    var split = part.split('x');
                    if (split.length == 2) {
                        var width = split[0] * 1,
                            height = split[1] * 1;
                        if (width > 0 && height > 0) {
                            variant.width = width;
                            variant.height = height;
                        }
                    }
                }
            }

            item.image.variants.push(variant);
        }

        item.media = [];
        var streams = responseObject.data.attributes.streams;
        if (streams) {
            for (var stream of streams) {

                var info = {};
                info.url = stream.url;
                info.type = stream.url.indexOf('.m3u8') !== -1 ? 'application/x-mpegURL' : 'video/mp4';
                //info.bitrate = bitrate; // bitrate missing
                info.comment = stream.mainQuality.label;
                item.media.push(info);

            }
        }

        // As of January 2020, subtiles are pre-baked on the video.

        return item;

    },


    /**
     * Get item by a webpage URL from this publisher.f
     *
     * @param url The webpage URL of the item
     * @return object The item
     */
    readItemByPageURL: async function (url) {


        // Example ID: 041664-000-A
        //             046190-000_PLUS7-D

        // Example URL: https://www.arte.tv/de/videos/069798-000-A/das-vhs-imperium/


        var parts = url.split('/');
        var language = parts[3].length == 2 ? parts[3] : 'de';

        for (var part of parts) {
            if (isFinite(part[0])) {
                var segments = part.split('-');
                var isID = segments.length == 3 && isFinite(segments[0]);
                if (isID) {
                    return this.readItemByID(part + '_' + language);
                }
            }
        }
    },

    /**
     * Get a program's feed
     *
     * @param {object} feedDescriptor A descriptor that contains the ID of the program
     * @return {array} A list of item descriptors (itemID, title, description, ...)
     */
    readProgramFeed: async function (feedDescriptor) {

        var id = feedDescriptor.programID;

        // Determine the language code (de or fr)
        var language;
        {
            var split = id.split('_');
            if (split.length == 2) {
                id = split[0];
                language = split[1];
            }
            else {
                language = 'de';
            }
        }


        //console.log('Loading feed for ARTE program ID '+id);

        var url = 'https://www.arte.tv/hbbtvv2/services/web/index.php/EMAC/teasers/collection/v2/' + id + '/' + language;

        var response = await requestResponseFromURL(url);
        if (response.statusCode != 200) {
            throw 'Unexpected status code when reading ARTE program feed: ' + response.statusCode;
        }

        var apiData;
        try { apiData = JSON.parse(response.body); } catch { apiData = null; }

        if (!apiData || !apiData.subCollections) {
            throw 'Unexpected response when reading ARTE program feed: ' + response.body;
        }

        var descriptors = [];

        var fixHTMLEntities = function (string) {
            string = string.replace('&amp;', '&');
            string = string.replace('&quot;', '"');
            return string;
        };

        for (var collection of apiData.subCollections) {
            var videos = collection.videos;
            if (!videos) { continue; }
            for (var video of videos) {
                if (video.duration * 1 == 0) { continue; }

                var descriptor = {};
                descriptor.id = video.id;
                descriptor.publisher = this.publisher;
                descriptor.title = fixHTMLEntities(video.title);
                descriptor.subtitle = fixHTMLEntities(video.subtitle);
                descriptor.description = fixHTMLEntities(video.shortDescription);
                descriptor.duration = (video.duration * 60) | 0;
                descriptor.image = {
                    variants: [{
                        url: video.imageUrl, width: 400, height: 225
                    }]
                };
                if (video.beginsAt) {
                    descriptor.broadcasts = +new Date(video.beginsAt) / 1000;
                }

                descriptors.push(descriptor);

            }
            //console.log(videos);
        }

        return descriptors;
    },


    /**
     * Get all available programs for this publisher
     *
     */
    readListOfPrograms: async function () {

        console.log('Loading ARTE programs list');
        const programs = [];

        for (const language of ['de', 'fr']) {

            var url = 'http://www.arte.tv/hbbtvv2/services/web/index.php/OPA/v3/magazines/' + language

            var response = await requestResponseFromURL(url);
            if (response.statusCode != 200) {
                throw 'Unexpected status code when reading ARTE program list: ' + response.statusCode;
            }

            var apiData;
            try { apiData = JSON.parse(response.body); } catch { apiData = null; }

            if (!apiData || !apiData.magazines) {
                throw 'Unexpected response when reading ARTE program feed: ' + response.body;
            }

            for (var magazine of apiData.magazines) {

                var program = {};
                program.id = magazine.programId + '_' + language;
                program.publisher = this.publisher;
                program.name = magazine.title;
                program.subtitle = magazine.subtitle;
                program.description = magazine.shortDescription;
                program.language = magazine.language;
                program.homepage = 'https://www.arte.tv/' + magazine.language + '/videos/' + program.id + '/';
                if (magazine.imageUrl?.includes('400x225')) {
                    program.image = [
                        { url: magazine.imageUrl, width: 400, height: 225 },
                        { url: magazine.imageUrl.replace('400x225', '400x400'), width: 400, height: 400 }
                    ];
                }
                if (!program.name) { continue; }
                programs.push(program);

            }

        }

        return programs;

    },

    feedDescriptorForProgram: async function (programID) {
        return { programID: programID };
    },

    internal: {


        call2019API: async function (apiURL, itemID, recursiveCall) {

            console.log('Calling ARTE API: ' + apiURL + ' for itemID: ' + itemID);

            var response = await requestResponseFromURL(apiURL);

            var apiDataRaw = response.body;
            var statusCode = response.statusCode;
            var apiData;
            try { apiData = JSON.parse(apiDataRaw); } catch { apiData = null; }

            if (response.statusCode == 401) {

                if (recursiveCall || itemID.length == 0) throw 'Server responded with: Authentication failed.';

                return await ArteTvAdapter.internal.call2019API(apiURL, itemID, true);

            }


            if (!apiData) {
                throw 'Could not decode JSON.';
            }
            if (apiData.error) {
                throw 'API responded with error: ' + JSON.stringify(apiData);
            }
            return apiData;

        },

        nameForProgramID: async function (programID, language) {

            var url = 'https://www.arte.tv/hbbtvv2/services/web/index.php/EMAC/teasers/collection/v2/' + programID + '/' + language;

            var response = await requestResponseFromURL(url);
            if (response.statusCode != 200) {
                throw 'Unexpected status code when reading ARTE program feed: ' + response.statusCode;
            }

            var apiData;
            try { apiData = JSON.parse(response.body); } catch { apiData = null; }

            return '' + apiData.meta.title;

        }

    }


};