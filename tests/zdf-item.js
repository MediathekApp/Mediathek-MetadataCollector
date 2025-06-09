import { runTest } from "./context.js";
import { ZDFAdapter } from "../adapters/2-ZDF.js";

runTest(async () => {

    const item = await ZDFAdapter.readItemByID("men-in-black-3-104");
    console.log(item);

})
