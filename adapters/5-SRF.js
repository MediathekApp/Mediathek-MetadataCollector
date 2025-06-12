export const SRFAdapter = {

    publisher: 'SRF',

    readItemByID: async function (id) {

        var asset = await requestDataFromURL('https://il.srgssr.ch/integrationlayer/2.0/mediaComposition/byUrn/urn:srf:video:' + id + '.json?onlyChapters=true&vector=portalplay');

        var data = JSON.parse(asset);
        if (!data) throw 'Error getting data';

        var item = {};
        item.id = id;
        item.publisher = this.publisher;
        item.title = data.episode.title;

        if (!data.chapterList || !data.chapterList.length) {
            console.log('data.chapterList missing or empty');
            return item;
        }
        var chapter = data.chapterList[0];

        var description = ((chapter.lead || '') + ' ' + (chapter.description || '')).trim();

        item.description = description;
        item.duration = (chapter.duration / 1000) | 0;


        item.broadcasts = (+new Date(chapter.date)) / 1000;
        // expires missing?
        if (chapter.validTo) {
            item.expires = (+new Date(chapter.validTo)) / 1000;
        }

        item.geoblocked = !chapter.playableAbroad;
        item.language = 'de';

        item.webpageURL = 'https://www.srf.ch/play/tv/_/video/_?id=' + item.id;

        // ratingInfo missing

        item.program = {};
        item.program.name = data.show.title;
        item.program.id = data.show.id;

        if (item.title.indexOf('(AD)') !== -1 || item.title.indexOf('Hörfassung') !== -1) {
            item.includesAudioDescription = true;
        }
        if (item.title.indexOf('Gebärden') !== -1) {
            item.includesSignLanguage = true;
        }


        item.image = {};
        item.image.description = chapter.imageTitle;
        item.image.copyright = chapter.imageCopyright;
        item.image.variants = [];
        for (var width of [0, 688, 220]) {
            var url = chapter.imageUrl;
            if (width == 0) {
                width = 1280;
            }
            else {
                url += '/scale/width/' + width;
            }
            var height = Math.round(width / (16 / 9));

            item.image.variants.push(createImageVariant(url, width, height));
        }

        item.media = [];
        for (var resource of chapter.resourceList) {

            var info = {};
            info.url = resource.url;
            info.type = resource.mimeType;
            //info.bitrate = bitrate; // bitrate missing
            info.comment = resource.streaming + ' ' + resource.quality;
            item.media.push(info);

        }

        // SRF provides subtitles inside the HLS playlist.

        return item;

    },

    readItemByPageURL: async function (url) {

        const urlObj = parseURL(url);

        let video_id = '';

        const urn = urlObj.searchParams.get('urn');
        if (urn) {
            // Example: urn:srf:video:8d56e7ed-1ae2-4b20-9a52-51da7a4b9827
            const segments = urn.split(':');
            if (segments.length < 4 || segments[0] != 'urn' || segments[1] != 'srf' || segments[2] != 'video') {
                throw 'Invalid URN: ' + urn;
            }
            video_id = segments[3];
        }

        // old URL format (ca. 2019)
        if (!video_id) video_id = urlObj.searchParams.get('id');

        if (!video_id.length) {
            throw 'Invalid URL';
        }

        return this.readItemByID(video_id);

    },

    readProgram: async function (programID) {

        const url = 'https://www.srf.ch/play/v3/api/srf/production/show-detail/' + programID;
        const response = await requestResponseFromURL(url);
        if (response.statusCode != 200) {
            throw 'Unexpected status code when reading SRF program: ' + response.statusCode;
        }
        const apiData = JSON.parse(response.body);
        if (!apiData || !apiData.data) {
            throw 'Unexpected response when reading SRF program: ' + response.body;
        }

        const program = SRFAdapter.programFromApiData(apiData.data);
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

        //console.log('Loading feed for SRF program ID '+id);

        var url = 'https://www.srf.ch/play/v3/api/srf/production/videos-by-show-id?showId=' + id;

        var response = await requestResponseFromURL(url);
        if (response.statusCode != 200) {
            throw 'Unexpected status code when reading SRF program feed: ' + response.statusCode;
        }

        var apiData;
        try { apiData = JSON.parse(response.body); } catch { apiData = null; }

        if (!apiData || !apiData.data) {
            throw 'Unexpected response when reading SRF program feed: ' + response.body;
        }

        console.log(apiData.data.data);

        var descriptors = [];

        for (var episode of apiData.data.data) {

            var descriptor = {};
            descriptor.id = episode.id;
            descriptor.publisher = this.publisher;
            descriptor.title = episode.title;

            var description = ((episode.lead || '') + ' ' + (episode.description || '')).trim();

            descriptor.description = description;
            descriptor.image = {
                variants: [{
                    url: episode.imageUrl + '/scale/width/600', width: 600, height: 338
                }]
            };
            descriptor.subtitle = episode.subtitle;
            descriptor.webpageURL = episode.absoluteDetailUrl;
            descriptor.duration = episode.duration / 1000;
            descriptor.geoblocked = !episode.playableAbroad;
            descriptors.push(descriptor);

        }

        return descriptors;

    },

    /**
     * Get all available programs for this publisher
     *
     */
    readListOfPrograms: async function () {

        console.log('Loading SRF programs list');

        var url = 'https://www.srf.ch/play/v3/api/srf/production/shows'

        var response = await requestResponseFromURL(url);
        if (response.statusCode != 200) {
            throw 'Unexpected status code when reading SRF program list: ' + response.statusCode;
        }

        var list = JSON.parse(response.body);
        if (!list?.data) throw 'Error: Failed parsing JSON when reading list of programs from SRF.';
        // console.log(list);

        var programs = [];

        for (var obj of list.data) {

            var program = this.programFromApiData(obj);
            programs.push(program);

        }

        return programs;

    },

    programFromApiData: function (obj) {

        var program = {};
        program.id = obj.id;
        program.publisher = this.publisher;
        program.name = obj.title;
        program.description = obj.description || '';
        program.descriptionShort = obj.lead || '';
        program.image = [];
        if (obj.imageUrl) {
            program.image.push(SRFAdapter.createChannelImageVariant(obj.imageUrl, 240, 135));
            program.image.push(SRFAdapter.createChannelImageVariant(obj.imageUrl, 320, 180));
            program.image.push(SRFAdapter.createChannelImageVariant(obj.imageUrl, 480, 270));
            program.image.push(SRFAdapter.createChannelImageVariant(obj.imageUrl, 720, 405));
            program.image.push(SRFAdapter.createChannelImageVariant(obj.imageUrl, 960, 540));
            program.image.push(SRFAdapter.createChannelImageVariant(obj.imageUrl, 1920, 1080));
        }
        if (obj.posterImageUrl) {
            program.image.push(SRFAdapter.createChannelImageVariant(obj.posterImageUrl, 480, 720));
        }
        return program;

    },

    createChannelImageVariant: function (originalUrl, width, height) {
        return createImageVariant(`https://il.srgssr.ch/images/?imageUrl=${encodeURIComponent(originalUrl)}&format=jpg&width=${width}`, width, height);
    },


};