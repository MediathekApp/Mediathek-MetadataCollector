import { runTest } from "./context.js";
import { DreiSatAdapter } from "../bundle-test.js";
import fs from "fs";

runTest(async () => {
    const programs = await DreiSatAdapter.readListOfPrograms()
    fs.writeFileSync("output/3sat_programs.json", JSON.stringify(programs, null, 2));
    console.log(programs.length, programs);
})
