import { runTest } from "./context.js";
import { DreiSatAdapter } from "../adapters/3-DreiSat.js";

runTest(async () => {
    const token = await DreiSatAdapter.getFreshAPIToken();
    console.log("Token:", token);
})
