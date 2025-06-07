export const DreiSatAdapter = {

    publisher: '3sat',

    apiURLHost: 'api.3sat.de',

    tokenName: 'api.3sat.de',

    apiOrigin: 'https://www.3sat.de',

    urlToExtractAPIToken: 'https://www.3sat.de/gesellschaft/37-grad',

    readItemByID: ZDFAdapter.readItemByID,
    readItemByPageURL: ZDFAdapter.readItemByPageURL,
    readListOfPrograms: ZDFAdapter.readListOfPrograms,
    feedDescriptorForProgram: ZDFAdapter.feedDescriptorForProgram,
    readProgramFeed: ZDFAdapter.readProgramFeed,

    call2019API: ZDFAdapter.call2019API,
    getFreshAPIToken: ZDFAdapter.getFreshAPIToken,
    optimizeTitle: ZDFAdapter.optimizeTitle,

};
