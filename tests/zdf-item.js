import { runTest } from "./context.js";
import { ZDFAdapter } from "../bundle-test.js";

runTest(async () => {
    // const item = await ZDFAdapter.readItemByID("markus-lanz-vom-27-mai-2025-100");
    // console.log(item);

    const item2 = await ZDFAdapter.readItemByID("abenteuer-amazonien-expedition-in-den-regenwald-doku-100");
    console.log(item2);
})
