import { runTest } from "./context.js";
import { ARDMediathekAdapter } from "../adapters/1-ARDMediathek.js";

runTest(async () => {
    const feed = await ARDMediathekAdapter.readProgramFeed({
        programID: 'Y3JpZDovL2Rhc2Vyc3RlLmRlL3RhZ2Vzc2NoYXU' // Tagesschau 20 Uhr
    });
    console.log(feed);
})
