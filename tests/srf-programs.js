import { runTest } from "./context.js";
import { SRFAdapter } from "../bundle-test.js";
import fs from "fs";

runTest(async () => {
    const programs = await SRFAdapter.readListOfPrograms()
    fs.writeFileSync("output/srf_programs.json", JSON.stringify(programs, null, 2));
    console.log(programs.length, programs);
})
