import { runTest } from "./context.js";
import { ARDMediathekAdapter } from "../bundle-test.js";

runTest(async () => {
    const program = await ARDMediathekAdapter.readProgram("Y3JpZDovL2Rhc2Vyc3RlLmRlL3RhZ2Vzc2NoYXU");
    console.log(program);
})
