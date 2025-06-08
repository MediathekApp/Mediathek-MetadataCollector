import { runTest } from "./context.js";
import { DreiSatAdapter } from "../bundle-test.js";

runTest(async () => {
    const token = await DreiSatAdapter.getFreshAPIToken();
    console.log("Token:", token);
})
