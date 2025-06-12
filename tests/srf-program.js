import { runTest } from "./context.js";
import { SRFAdapter } from "../adapters/5-SRF.js";

runTest(async () => {
    const program = await SRFAdapter.readProgram("99e0b828-1704-41d5-b275-e061324cb5f0");
    console.log(program);
})
