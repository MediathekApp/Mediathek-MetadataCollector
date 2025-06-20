
function getProgramList(callback, publisherId) {

    const adapter = getPublisherAdapterById(publisherId);

    if (!adapter) {
        callback('Publisher not supported: ' + publisherId, null);
        return;
    }

    adapter.readListOfPrograms()
        .then(programs => {
            // Assign URNs to each program
            programs.forEach(program => {
                program.urn = `urn:mediathek:${publisherId}:program:${program.id}`;
            })
            callback(null, JSON.stringify(programs));
        })
        .catch(error => {
            console.error("Error retrieving program list:", error);
            callback(error, null);
        });

}

async function getUrnForUrl(callback, url) {

    console.log("getUrnForUrl called with URL:", url);

    try {
        const uri = getUrnForUrlAsValue(url)
        callback(null, uri);
    }
    catch (error) {
        console.error("Error in getUrnForUrl:", error);
        callback(error, null);
    }

}

function getUrnForUrlAsValue(url) {

    // ARD Mediathek
    if (url.startsWith('https://www.ardmediathek.de/')) {

        var urlInfo = parseURL(url);
        if (urlInfo.host != 'www.ardmediathek.de') {
            throw "Unexpected host, should be 'www.ardmediathek.de' but is " + urlInfo.host + ".";
        }

        var pathParts = urlInfo.pathname.split('/');


        // Item – example: https://www.ardmediathek.de/video/moneyland-die-dunklen-geschaefte-der-finanzindustrie/moneyland/arte/Y3JpZDovL2FydGUudHYvcHVibGljYXRpb24vMTAxOTE4LTAwMC1B

        if (pathParts[1] == 'video' || pathParts[1] == 'player') {

            let itemId = '';

            // expected path: /video/SENDUNG/FOLGE/SENDER/ID
            if (pathParts[1] == 'video') {
                itemId = pathParts[5];
            }
            else if (pathParts[1] == 'player') {
                // old URL scheme (2019)
                itemId = pathParts[4];
            }

            if (!itemId) {
                throw "Unexpected URL scheme, was expecting '/video/SENDUNG/FOLGE/SENDER/ID', got '" + urlInfo.pathname + "'.";
            }

            return 'urn:mediathek:ard:item:' + itemId

        }

        // Program – example: https://www.ardmediathek.de/sendung/morgenmagazin/Y3JpZDovL2Rhc2Vyc3RlLmRlL21vcmdlbm1hZ2F6aW4

        if (pathParts[1] == 'sendung') {

            let programId = pathParts[3];
            if (!programId) {
                throw "Unexpected URL scheme, was expecting '/sendung/name/ID', got '" + urlInfo.pathname + "'.";
            }

            return 'urn:mediathek:ard:program:' + programId;
        }

        throw 'Could not guess URN for ARD URL: ' + url;
    }

    // Arte
    if (url.startsWith('https://www.arte.tv/')) {

        // Item – example: https://www.arte.tv/de/videos/098777-000-A/jackie-chan-mit-humor-und-schlagkraft/
        // Program – example: https://www.arte.tv/de/videos/RC-025017/konzerte-und-shows/

        var parts = url.split('/');
        var language = parts[3].length == 2 ? parts[3] : 'de';

        for (var part of parts) {

            if (part.startsWith('RC-')) {
                return 'urn:mediathek:arte:program:' + part;
            }

            if (isFinite(part[0])) {
                var segments = part.split('-');
                var isItemID = segments.length == 3 && isFinite(segments[0]);
                if (isItemID) {
                    const itemId = part + '_' + language;
                    return 'urn:mediathek:arte:item:' + itemId;
                }
            }
        }

        throw 'Could not extract item ID from ARTE URL: ' + url;

    }

    // ZDF
    if (url.startsWith('https://www.zdf.de/')) {

        // Items – example:
        // - https://www.zdf.de/video/serien/crystal-wall-100/blut-auf-gold-100
        // - https://www.zdf.de/play/serien/crystal-wall-100/blut-auf-gold-100

        var parts = url.split('/');

        if (['video', 'play'].includes(parts[3])) {

            var video_id = parts[parts.length - 1];
            video_id = video_id.replace('.html', '');

            // If the video_id contains a tilde, re strip the tilde with everything after it
            if (video_id.includes('~')) {
                video_id = video_id.split('~')[0];
            }

            if (video_id.length < 6) {
                throw 'Could not extract item ID from ZDF URL: ' + url;
            }

            return 'urn:mediathek:zdf:item:' + video_id;

        }

        // Programs – example:
        // - https://www.zdf.de/magazine/heute-journal-104

        if (parts.length == 5 && !['nachrichten', 'assets', 'live-tv', '3sat'].includes(parts[3])) {
            return 'urn:mediathek:zdf:program:' + parts[4];
        }

        throw 'Could not guess URN for ZDF URL: ' + url;

    }

    if (url.startsWith('https://www.zdfheute.de/')) {

        // Example:
        // - https://www.zdfheute.de/video/heute-journal-update/start-deutsches-turnfest-100.html

        var parts = url.split('/');

        // Check if the URL contains a video ID
        if (parts.length < 6 || parts[3] !== 'video') {
            throw 'Could not guess URN for ZDFheute URL: ' + url;
        }

        var video_id = parts[parts.length - 1];
        video_id = video_id.replace('.html', '');

        if (video_id.length < 6) {
            throw 'Could not extract item ID from ZDF URL: ' + url;
        }

        return 'urn:mediathek:zdf:item:' + video_id;
    }

    // SRF
    if (url.startsWith('https://www.srf.ch/play/')) {

        // Example: https://www.srf.ch/play/tv/rec-/video/arbeiten-in-der-kita---viel-verantwortung-wenig-lohn-und-anerkennung?urn=urn:srf:video:8d56e7ed-1ae2-4b20-9a52-51da7a4b9827

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

        return 'urn:mediathek:srf:item:' + video_id;

    }

    // 3sat
    if (url.startsWith('https://www.3sat.de/')) {

        // Example: https://www.3sat.de/dokumentation/natur/der-zauber-der-dolomiten-100.html

        var parts = url.split('/');
        var video_id = parts[parts.length - 1];
        video_id = video_id.replace('.html', '');

        if (video_id.length < 6) {
            throw 'Could not extract item ID from ZDF URL: ' + url;
        }

        return 'urn:mediathek:3sat:item:' + video_id;
    }

    // If we reach this point, the URL is not supported
    throw 'Unsupported URL: ' + url;

}

function parseURN(urn) {

    // Example: urn:mediathek:ard:item:ITEM_ID

    const urnParts = urn.split(':');

    if (urnParts.length < 5 || urnParts[0] !== 'urn' || urnParts[1] !== 'mediathek') {
        throw new Error('Invalid URN format: ' + urn);
    }

    const publisher = urnParts[2];
    const type = urnParts[3];
    const id = urnParts[4];

    return { publisher, type, id };

}

function parseUrnAndGetAdapter(urn, forType) {

    try {
        const urnInfo = parseURN(urn);
        if (!urnInfo || !urnInfo.publisher || !urnInfo.type || !urnInfo.id) {
            throw new Error('Invalid URN structure: ' + urn);
        }
        if (forType !== undefined && urnInfo.type !== forType) {
            throw new Error('URN type mismatch: expected ' + forType + ', got ' + urnInfo.type);
        }
        const adapter = getPublisherAdapterById(urnInfo.publisher);
        if (!adapter) {
            throw new Error('Publisher not supported: ' + urnInfo.publisher);
        }
        return { urnInfo, adapter };
    } catch (error) {
        throw new Error('Error validating adapter for URN: ' + urn + ' - ' + error.message);
    }

}

async function getMetadataForItem(callback, urn, asJSON = true) {

    try {
        const { urnInfo, adapter } = parseUrnAndGetAdapter(urn, 'item');
        const item = await adapter.readItemByID(urnInfo.id);
        item.captured = Math.floor(Date.now() / 1000);
        item.urn = urn;
        callback(null, asJSON ? JSON.stringify(item) : item);

    } catch (error) {
        callback(error, null);
        return;
    }

}

async function getMetadataForProgram(callback, urn, asJSON = true) {
    console.log("getMetadataForProgram called with URN:", urn);

    try {
        const { urnInfo, adapter } = parseUrnAndGetAdapter(urn, 'program');
        const program = await adapter.readProgram(urnInfo.id);
        program.captured = Math.floor(Date.now() / 1000);
        program.urn = urn;
        callback(null, asJSON ? JSON.stringify(program) : program);

    } catch (error) {
        const line = error.lineNumber || error.line || 'unknown';
        const stack = error.stack || 'No stack trace available';
        console.error(`Error in getMetadataForProgram at line ${line}:`, error.message, stack);
        callback(error, null);
        return;
    }

}


async function getProgramFeed(callback, urn) {
    try {

        // Example: urn:mediathek:ard:program:CHANNEL_ID

        const urnParts = urn.split(':');
        if (urnParts.length != 5 || urnParts[0] !== 'urn' || urnParts[1] !== 'mediathek') {
            callback('Invalid URN format: ' + urn, null);
            return;
        }

        if (urnParts[3] !== 'program') {
            callback('URN does not refer to a program: ' + urn, null);
            return;
        }

        const publisherId = urnParts[2];

        const adapter = getPublisherAdapterById(publisherId);

        if (!adapter) {
            throw new Error('Publisher adapter not found for id ' + publisherId + ', URN was: ' + urn);
            return;
        }

        const programId = urnParts[4];
        const feedDescriptor = await adapter.feedDescriptorForProgram(programId);
        const items = await adapter.readProgramFeed(feedDescriptor);
        // console.log("Response from ZDF API:", JSON.stringify(items));
        const programFeed = {
            items: items
        };
        callback(null, JSON.stringify(programFeed));


    } catch (error) {
        callback(error, null);
    }

}

// Helper function that reads contents of a URL as a string:
export function requestResponseFromURL(url, headers = {}) {

    return new Promise((resolve, reject) => {

        readContentsOfURLAsString(url, headers, function (error, responseText, responseStatus) {
            resolve({ statusCode: responseStatus, body: responseText, error: error });
        })

    })
}

// Helper function that only return the body of the response:
export async function requestDataFromURL(url, headers = {}) {
    const response = await requestResponseFromURL(url, headers);
    return response.body;
}

// Forward console messages:
if (globalThis?.nativeLog) globalThis.console = (function () {

    const log = globalThis?.nativeLog;
    const existing = globalThis?.console;
    if (existing && !log) {
        nativeLog("Console already exists, extending it", "debug");
        return existing;
    }

    function formatMessage(message, args) {
        return args.length > 0 ? `${message} ${args.join(" ")}` : message;
    }

    return {
        log: function (message, ...args) {
            log(formatMessage(message, args), "debug")
        },
        warn: function (message, ...args) {
            log(formatMessage(message, args), "warning");
        },
        error: function (message, ...args) {
            log(formatMessage(message, args), "error");
        },
        info: function (message, ...args) {
            log(formatMessage(message, args), "info");
        },
        debug: function (message, ...args) {
            log(formatMessage(message, args), "debug");
        },
    };

})();

// Parse an URL:
function parseURL(url) {
    const pattern = /^(?:[a-zA-Z][a-zA-Z\d+\-.]*:)?\/\/([^\/?#]+)([^?#]*)(?:\?([^#]*))?(?:#.*)?/;
    const match = url.match(pattern);

    if (!match) {
        throw new Error("Invalid URL format");
    }

    const host = match[1];
    let pathname = match[2] || '/';
    const queryString = match[3] || ''; // Extract the query string

    // Ensure pathname starts with a slash
    if (!pathname.startsWith('/')) {
        pathname = '/' + pathname;
    }

    // --- Custom searchParams implementation ---
    const queryParamsMap = {}; // Use a plain object to store parameters

    if (queryString) {
        // Split by '&' to get individual key-value pairs
        const pairs = queryString.split('&');
        for (const pair of pairs) {
            // Split each pair by '='
            let [key, value] = pair.split('=');

            // Decode URI components
            key = decodeURIComponent(key || '');
            value = decodeURIComponent(value || '');

            // Handle multiple values for the same key (e.g., ?a=1&a=2)
            // For simplicity, this implementation will store the last value.
            // If you need to support multiple values, you'd store an array.
            queryParamsMap[key] = value;
        }
        // console.log("Parsed query parameters:", JSON.stringify(queryParamsMap));
    }

    const searchParams = {
        get: function (name) {
            return queryParamsMap[name] !== undefined ? queryParamsMap[name] : null;
        }
        // You could add other methods here like .has(), .forEach(), etc.,
        // if you need more functionality.
    };
    // --- End Custom searchParams implementation ---

    return { host, pathname, searchParams };
}

// Create an image variant object from a URL and optional width and height:
export function createImageVariant(url, width, height) {

    var variant = {};
    variant.url = url;
    if (isFinite(width))
        variant.width = width * 1;
    if (isFinite(height))
        variant.height = height * 1;
    return variant;

}

// Helper function to extract a substring from a source string.
function getSubstring(source, prefix, suffix, offset) {

    var pos1 = source.indexOf(prefix, offset);
    if (pos1 == -1) { return false; }

    pos1 += prefix.length;
    var pos2 = source.indexOf(suffix, pos1);

    return source.substr(pos1, (pos2 - pos1));

}

function getPublisherAdapterById(publisherId) {
    const publishers = {
        'ard': ARDMediathekAdapter,
        'arte': ArteTvAdapter,
        'zdf': ZDFAdapter,
        'srf': SRFAdapter,
        '3sat': DreiSatAdapter
    };
    return publishers[publisherId] || null;
}
