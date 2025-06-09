import { runTest } from "./context.js";
import { ArteTvAdapter } from "../adapters/4-Arte.js";
import fs from "fs";

runTest(async () => {
    const programs = await ArteTvAdapter.readListOfPrograms()
    fs.writeFileSync("output/arte_programs.json", JSON.stringify(programs, null, 2));
    console.log(programs.length, programs);
})
