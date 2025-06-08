import { runTest } from "./context.js";
import { ZDFAdapter } from "../bundle-test.js";

runTest(async () => {
    const token = await ZDFAdapter.getFreshAPIToken();
    console.log("Token:", token);
})
