import { runTest } from "./context.js";
import { ZDFAdapter } from "../adapters/2-ZDF.js";
import fs from "fs";

runTest(async () => {
    const programs = await ZDFAdapter.readListOfPrograms()
    fs.writeFileSync("output/zdf_programs.json", JSON.stringify(programs, null, 2));
    console.log(programs.length, programs);
})
