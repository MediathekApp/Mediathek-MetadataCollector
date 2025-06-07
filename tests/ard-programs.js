import { runTest } from "./context.js";
import { ARDMediathekAdapter } from "../bundle-test.js";
import fs from "fs";

runTest(async () => {
    const programs = await ARDMediathekAdapter.readListOfPrograms()
    fs.writeFileSync("output/ard_programs.json", JSON.stringify(programs, null, 2));
    console.log(programs.length, programs);
})
