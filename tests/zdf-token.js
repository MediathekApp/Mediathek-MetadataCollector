import { runTest } from "./context.js";
import { ZDFAdapter } from "../adapters/2-ZDF.js";

runTest(async () => {
    const token = await ZDFAdapter.getFreshAPIToken();
    console.log("Token:", token);
})
