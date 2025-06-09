import { requestResponseFromURL, requestDataFromURL, createImageVariant } from "../shared.js";

export default function prepareContext(globalThis) {

    /**
     * {@typedef {function} ReadContentsCallback
     * @param {Error|null} error - The error object if an error occurred, or null if successful.
     * @param {string} responseText - The contents of the URL as a string.
     * @param {number} responseStatus - The HTTP status code of the response.
     */

    /**
     * Reads the contents of a URL as a string and calls the callback with the result.
     * @param {string} url - The URL to read.
     * @param {Object} headers - Optional headers to include in the request.
     * @param {ReadContentsCallback} callback - The callback function to call with the result.
     * @returns {void}
     */
    function readContentsOfURLAsString(url, headers, callback) {
    
        // Feth the contents of the URL and call the callback with the result
        let responseStatus;
        fetch(url, { headers })
            .then(response => {
                responseStatus = response.status;
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${responseStatus}`);
                }
                return response.text();
            })
            .then(responseText => {
                callback(null, responseText, responseStatus); // Assuming 200 as the status code for success
            })
            .catch(error => {
                callback(error, null, responseStatus); // Use the error status or default to 500
            });
        
    }

    globalThis.nativeLog = (message, logLevel) => {
        console.log(message);
    }

    globalThis.readContentsOfURLAsString = readContentsOfURLAsString;
    globalThis.requestDataFromURL = requestDataFromURL;
    globalThis.createImageVariant = createImageVariant;

    let tokens = {};

    globalThis.saveToken = (name, token) => {
        if (typeof name !== 'string' || !name) {
            throw new Error("Token name must be a non-empty string");
        }
        if (typeof token !== 'string' || !token) {
            throw new Error("Token must be a non-empty string");
        }
        tokens[name] = token;
    }

    globalThis.getToken = (name) => {
        return tokens[name];
    }

    globalThis.requestResponseFromURL = requestResponseFromURL;

}

export function runTest(asyncTestFunction) {
    prepareContext(globalThis);
    const startTime = Date.now();
    asyncTestFunction()
        .then(() => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            console.log(`Test completed in ${duration} ms`);
        })
        .catch(error => {
            console.error("Test failed:", error);
        });
}
