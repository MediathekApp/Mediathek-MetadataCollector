export const ZDFAdapter = {

    // Example identifiers:
    // - itemID: heute-journal-vom-4-dezember-2019-100
    // - programID: heute-journal-104, terra-x-112

    publisher: 'ZDF',

    apiURLHost: 'api.zdf.de',

    /**
     * Get item by a publisher-specific ID.
     *
     * @param id The ID of the item
     * @return Item The item
     */
    readItemByID: async function (itemID) {

        // Example: heute-journal-vom-4-dezember-2019-100

        var item = {};
        item.id = itemID;
        item.publisher = this.publisher;

        var apiURL = 'https://' + this.apiURLHost + '/content/documents/' + itemID + '.json?profile=player2';
        var apiData = await this.call2019API(apiURL, itemID, 'item');

        if (!apiData) {
            throw 'API responded with empty body (item id = ' + itemID + ')';
        }
        if (!(typeof apiData.title == 'string')) {
            if (apiData.profile && apiData.profile.indexOf('gallery') !== -1) {
                // It's a gallery, return empty item for caching.
                return item;
            }
            throw 'Unexpected API response (item id = ' + itemID + ', URL: ' + apiURL + '):' + "\n" + JSON.stringify(apiData);
        }

        // console.log('ZDFAdapter.readItemByID: ' + itemID);
        // console.log(apiData);


        item.originator = apiData.tvService;
        item.title = this.optimizeTitle(apiData.title);
        item.description = (apiData.leadParagraph || '').trim();


        var broadcasts = Date.parse(apiData.editorialDate);
        if (broadcasts) item.broadcasts = broadcasts / 1000;

        // geoblocked missing.
        //item.geoblocked =

        item.language = 'de';
        item.webpageURL = apiData['http://zdf.de/rels/sharing-url'] || "https://www.zdf.de/video/" + itemID;

        // ratingInfo missing.
        //item.ratingInfo = 

        item.program = {};
        item.program.id = apiData['http://zdf.de/rels/brand']?.['http://zdf.de/rels/target']?.id ?? '';
        item.program.name = apiData['http://zdf.de/rels/brand']?.title ?? '';
        this.optimizeProgram(item.program);

        if (item.title.indexOf('(AD)') !== -1 || item.title.indexOf('Hörfassung') !== -1) {
            item.includesAudioDescription = true;
        }
        if (item.title.indexOf('Gebärden') !== -1) {
            item.includesSignLanguage = true;
        }


        var image = {};
        image.description = apiData.teaserImageRef.caption;
        image.copyright = apiData.teaserImageRef.copyrightNotice;
        image.variants = [];
        if (apiData.teaserImageRef.layouts) {
            for (var key in apiData.teaserImageRef.layouts) {
                var value = apiData.teaserImageRef.layouts[key];
                if (key == 'original') continue;
                var size = key.split('x');
                image.variants.push(createImageVariant(value, size[0], size[1]));
            }
        }

        item.image = image;


        var videoContent = apiData.mainVideoContent;
        if (!videoContent && apiData.mainContent) {
            videoContent = apiData.mainContent.videoContent;
        }

        if (!videoContent) {
            // This item has no video.
            return item;
        }

        videoContent = videoContent['http://zdf.de/rels/target'];

        item.duration = videoContent.duration;

        var expires = Date.parse(videoContent.visibleTo);
        if (expires) item.expires = expires / 1000;

        // media and subtitles
        item.media = [];
        item.subtitles = [];
        var urlTemplate = videoContent['http://zdf.de/rels/streams/ptmd-template'];
        if (urlTemplate && urlTemplate.length) {
            var url = 'https://api.zdf.de' + urlTemplate.replace('{playerId}', 'ngplayer_2_3');
            var videoInfo = await this.call2019API(url, itemID, 'itemmedia');

            //console.log(videoInfo);

            if (videoInfo.captions) {
                for (var info of videoInfo.captions) {
                    var format;
                    if (info.format == 'ebu-tt-d-basic-de') { format = 'ttml'; }
                    else if (info.format == 'webvtt') { format = 'webvtt'; }
                    else { format = 'unknown'; }

                    var language;
                    if (info.language == 'deu') { language = 'de'; }
                    else if (info.language == 'eng') { language = 'en'; }
                    else { language = ''; }

                    var subtitleObj = {
                        format: format,
                        language: language,
                        url: info.uri
                    };

                    if (info.offset) {
                        subtitleObj.offset = info.offset;
                    }

                    item.subtitles.push(subtitleObj)
                }
            }


            var downloadAllowed = false;

            // Download is allowed:
            if (typeof videoInfo.attributes === 'object' && typeof videoInfo.attributes.downloadAllowed === 'object') {
                downloadAllowed = videoInfo.attributes.downloadAllowed.value;
                if (downloadAllowed) {
                    item.downloadAllowed = true;
                }
            }

            if (videoInfo.priorityList) {
                for (var list of videoInfo.priorityList) {
                    for (var formitaet of list.formitaeten) {
                        for (var qualityInfo of formitaet.qualities) {
                            for (var trackInfo of qualityInfo.audio.tracks) {
                                let bitrate = 0; // Unknown.
                                if (qualityInfo.quality == 'veryhigh') bitrate = 15000;
                                if (qualityInfo.quality == 'high') bitrate = 10000;
                                if (qualityInfo.quality == 'med') bitrate = 9000;
                                if (qualityInfo.quality == 'low') continue; // skipping low
                                url = trackInfo.uri;
                                if (url.indexOf('manifest.f4m') != -1) continue;
                                if (url.indexOf('.webm') !== -1) continue;
                                if (url.indexOf('_hd.') !== -1) item.HD = true;


                                var info = {};
                                info.url = url;
                                info.type = url.indexOf('.m3u8') !== -1 ? 'application/x-mpegURL' : 'video/mp4';
                                info.bitrate = bitrate;
                                info.comment = 'Quality ' + qualityInfo.quality;
                                info.downloadAllowed = downloadAllowed;
                                item.media.push(info);

                            }
                        }
                    }
                }
            }
        }

        return item;

    },

    /**
     * Get item by a specific webpage URL from this publisher.
     *
     * @param URL The web URL of the item
     * @return object The item
     */
    readItemByPageURL: async function (url) {

        var parts = url.split('/');
        video_id = parts[parts.length - 1];
        video_id = video_id.replace('.html', '');

        return this.readItemByID(video_id);

    },

    tokenName: 'api.zdf.de',
    apiOrigin: 'https://www.zdf.de',

    // Calls the ZDF API.
    // The profile 'player2' seems to be the optimized API call for the web.
    // There is also a profile 'default' with 1-2 megabyte payload.
    call2019API: async function (apiURL, itemID, type, recursiveCall = false) {

        console.log("Calling ZDF API with URL: " + apiURL + ", itemID: " + itemID + ", type: " + type + ", recursiveCall: " + recursiveCall);

        var apiToken = getToken(this.tokenName);
        var response = await requestResponseFromURL(apiURL, {
            'Accept': 'application/vnd.de.zdf.v1.0+json',
            'Origin': this.apiOrigin,
            'Host': this.apiURLHost,
            'Api-Auth': 'Bearer ' + apiToken
        });

        const apiDataRaw = response.body;
        const statusCode = response.statusCode;

        if ('Authentication failed' == apiDataRaw || response.statusCode == 403) {

            if (recursiveCall || itemID.length == 0) {
                throw 'We need a new API token. Server responded with: Authentication failed. Current API token = ' + apiToken + ', requested URL = ' + apiURL + ' . Automated fetch from website failed.';
            }

            await this.getFreshAPIToken();

            return await this.call2019API(apiURL, itemID, type, true);
        }
        if (apiDataRaw[0] != '{') {
            throw 'Could not access API (' + apiURL + ') with API token ' + apiToken + '+ Got non-JSON response: ' + apiDataRaw;
        }

        const apiData = JSON.parse(apiDataRaw);

        if (!apiData) {
            throw 'Could not parse JSON';
        }
        if (apiData.error) {
            throw 'API responded with error: ' + JSON.stringify(apiData);
        }
        return apiData;

    },

    urlToExtractAPIToken: 'https://www.zdf.de/magazine/heute-journal-104',

    getFreshAPIToken: async function () {

        console.log('Fetching new API token for ' + this.publisher + '...');

        // Extract the new API token directly from the website's HTML.

        let webURL = this.urlToExtractAPIToken;
        let html = await requestDataFromURL(webURL);

        let prefix = `apiToken`;
        let suffix = `,`;

        let startPos = 0;
        let foundTokens = [];

        do {
            var pos = html.indexOf(prefix, startPos);
            var pos2 = html.indexOf(suffix, pos + prefix.length);

            if (pos === -1 || pos2 === -1) {
                break;
            }

            pos += prefix.length;

            let token = html.substr(pos, (pos2 - pos - 1));
            startPos = pos2 + suffix.length;

            // Remove everything that is not alphanumeric.
            token = token.replace(/[^a-zA-Z0-9]/g, '');
            token = token.trim();
            if (token.length < 10) {
                console.warn('ZDFAdapter.getFreshAPIToken: Found token is too short: ' + token);
                continue;
            }
            foundTokens.push(token);
        } while (pos !== -1 && pos2 !== -1);

        if (foundTokens.length == 0) {
            throw 'Failed to obtain a new API token for ZDF.';
        }

        console.log('Found ' + foundTokens.length + ' API tokens in HTML: ' + foundTokens.join(', '));

        let token = foundTokens[0];

        saveToken(this.tokenName, token);

        console.log('New API token for ' + this.publisher + ': ' + token);

        return token;

    },

    optimizeTitle: function (title) {
        return title;
    },

    optimizeProgram: function (program) {
        if (!program.id) {
            if (program.name == 'Terra X') {
                program.id = 'terra-x-112';
            }
        }
    },

    /**
     * Returns a token that contains information on how to obtain a feed for a program.
     *
     * @param programID The ID of the program
     * @return object The descriptor
     */
    feedDescriptorForProgram: async function (programID) {

        // There are podcast RSS feeds available for some shows, but they are not updated often enough.
        // https://www.zdf.de/rss/podcast/video/zdf/nachrichten/heute-journal
        // https://www.zdf.de/rss/podcast/video/zdf/nachrichten/heute-19-uhr

        var apiURL = 'https://' + this.apiURLHost + '/content/documents/' + programID + '.json?profile=navigation';
        var apiData = await this.call2019API(apiURL, programID, 'program');

        if (!apiData || !apiData.structureNodePath) {
            throw 'Unexpected response from server: ' + JSON.stringify(apiData);
        }

        var structureNodePath = apiData.structureNodePath;
        var rssURL = this.apiOrigin + '/rss' + structureNodePath;

        return { programID: programID, externalID: apiData.externalId, rssURL: rssURL }

    },


    /**
     * Get a program's feed
     *
     * @param feedDescriptor A descriptor that contains the ID of the program and the RSS URL
     * @param feedDescriptor.rssURL The RSS URL of the program
     * @param feedDescriptor.externalID The external ID of the program (HbbTV)
     * @return array A list of item descriptors (itemID, title, description)
     */
    readProgramFeed: async function (feedDescriptor) {

        //console.debug('ZDF readProgramFeed feedDescriptor: ' + JSON.stringify(feedDescriptor));

        if (!feedDescriptor || !feedDescriptor.rssURL) { throw 'Unexpected feed descriptor: ' + JSON.stringify(feedDescriptor); }

        // HbbTV works with ZDF only, not 3sat.
        if (feedDescriptor.externalID && this.publisher == 'ZDF') {

            var hbbtvData = JSON.parse(await requestDataFromURL('https://hbbtv.zdf.de/zdfm3/dyn/get.php?id=' + feedDescriptor.externalID));

            if (!hbbtvData) {
                throw 'No valid response from HbbTV service.';
            }

            // console.warn('hbbtvData:', JSON.stringify(hbbtvData));

            var descriptors = [];
            var ids = {};
            for (var elem of hbbtvData.elems) {

                if (elem.variant == 'std' || elem.variant == 'wide') {

                    if (!elem.elems?.length) { continue; }

                    var i = 0;
                    for (var ilem of elem.elems) {

                        if (!ilem.hasVideo) { continue; }

                        var pagePath = ilem.link?.htmlAnchor?.href;
                        //console.debug('ZDF readProgramFeed: pagePath: ' + pagePath);
                        var id = pagePath?.substr(pagePath.lastIndexOf('/') + 1).replace('.html', '');
                        if (!id) {
                            continue;
                            //                            throw 'Could not extract ID from HbbTV data.';
                        }

                        if (ids[id]) { continue; }
                        ids[id] = true;

                        descriptors.push({
                            id: id,
                            publisher: this.publisher,
                            title: ilem.titletxt,
                        });

                        i++;
                        if (i == 10) break;

                    }


                }
            }
            return descriptors;


        }
        else {
            var xmlData = await requestDataFromURL(feedDescriptor.rssURL);

            if (xmlData[0] != '<') {
                throw 'ZDF RSS feed broken, got invalid response: ' + xmlData + ' - Feed URL was ' + feedInfo.rssURL;
            }

            // In absence of a XML parser, we do simple string extraction here.

            function htmlDecodeEntities(str) {
                var str = str.replace(/&#(\d+);/g, function (match, dec) {
                    return String.fromCharCode(dec);
                });
                str = str.replace(/&quot;/g, '"');
                str = str.replace(/&amp;/g, '&');
                return str;
            }


            //console.warn('Parsing feed '+feedInfo.rssURL);

            var descriptors = [];
            var pos = 0;
            do {
                pos = xmlData.indexOf('<item>', pos + 1);
                if (pos === -1) break;

                var itemXML = getSubstring(xmlData, '<item>', '</item>', pos);
                var url = getSubstring(itemXML, '<link>', '</link>');
                var title = getSubstring(itemXML, '<title>', '</title>');
                var description = getSubstring(itemXML, '<description>', '</description>');
                var summary = getSubstring(itemXML, '<itunes:summary>', '</itunes:summary>');
                var broadcasts = getSubstring(itemXML, '<pubDate>', '</pubDate>');
                broadcasts = +new Date(broadcasts) / 1000;

                var pieces = url.split('/');
                var id = pieces.pop();
                id = id.replace('.html', '');

                if (!id) {
                    console.warn('Unrecognized ID in feed.');
                    continue;
                }

                descriptors.push({
                    id: id,
                    publisher: this.publisher,
                    title: htmlDecodeEntities(title),
                    description: htmlDecodeEntities(description || summary),
                    broadcasts: broadcasts,
                });

            } while (1);

            return descriptors;

        }

    },

    /**
     * Get all programs that are available from this publisher.
     * Warning: The API response here is over 7 megabyte.
     *
     * @return array A list of program objects.
     */
    readListOfPrograms: async function () {

        var apiURL = 'https://' + this.apiURLHost + '/content/documents/sendungen-100.json?profile=default';
        var apiData = await this.call2019API(apiURL, this.publisher + '_programlist_sendungen-100', 'programs');

        if (!apiData || !apiData.brand) { throw 'Unexpected response from server:' + JSON.stringify(apiData); }

        //fs.writeFileSync(this.publisher+'-programs.json',JSON.stringify(apiData));

        var programs = [];

        for (var collection of apiData.brand) {

            if (!collection.teaser) continue;

            for (var teaser of collection.teaser) {

                var targetObj = teaser['http://zdf.de/rels/target'];
                if (!targetObj) { continue; }

                var program = {};
                program.id = targetObj.id;
                program.publisher = this.publisher;
                try {
                    program.originator = targetObj['http://zdf.de/rels/content/conf-section'].homeTvService.tvServiceTitle;
                } catch (err) { }

                program.name = teaser.title;
                program.description = targetObj.teasertext || '';
                program.language = 'de';
                program.homepage = targetObj['http://zdf.de/rels/sharing-url'];

                program.image = [];

                var imageVariants = targetObj.teaserImageRef.layouts;

                if (imageVariants) {
                    if (imageVariants['640x720']) {
                        var image = {};
                        image.width = 640;
                        image.height = 720;
                        image.url = imageVariants['640x720'];
                        program.image.push(image);
                    }
                    if (imageVariants['3000x3000']) {
                        var image = {};
                        image.width = 3000;
                        image.height = 3000;
                        image.url = imageVariants['3000x3000'];
                        program.image.push(image);
                    }
                    if (imageVariants['768x432']) {
                        var image = {};
                        image.width = 768;
                        image.height = 432;
                        image.url = imageVariants['768x432'];
                        program.image.push(image);
                    }
                }

                programs.push(program);
            }
        }

        return programs;

    },

    /**
     * Get metadata of a program
     *
     * @param ID The ID of the program
     * @return object The program
     */
    readProgram: async function (id) {

        var apiURL = 'https://' + this.apiURLHost + '/content/documents/' + id + '.json?profile=navigation';
        var apiData = await this.call2019API(apiURL, id, 'item');

        if (!apiData || !apiData.structureNodePath) {
            throw 'Unexpected response from server: ' + JSON.stringify(apiData);
        }

        const program = {};
        program.id = id;
        program.publisher = this.publisher;
        program.name = apiData.title;

        const teaserData = apiData.stage?.[0]?.teaser?.[0]?.['http://zdf.de/rels/target'];
        if (teaserData) {
            if (teaserData.layouts) {
                let image = [];
                for (var key in teaserData.layouts) {
                    var value = teaserData.layouts[key];
                    if (key == 'original') continue;
                    var size = key.split('x');
                    // Skip 1200x1200 for now, it is not cropped properly.
                    if (size[0] == '1200' && size[1] == '1200') continue;
                    image.push(createImageVariant(value, size[0], size[1]));
                }
                program.image = image;
            }

        }

        return program;

    },

};
