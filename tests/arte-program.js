import { runTest } from "./context.js";
import { ArteTvAdapter } from "../adapters/4-Arte.js";

runTest(async () => {
    const program = await ArteTvAdapter.readProgram("RC-018547_de");
    console.log(program);
})
