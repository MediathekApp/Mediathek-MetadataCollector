import { runTest } from "./context.js";
import { ArteTvAdapter } from "../adapters/4-Arte.js";

runTest(async () => {
    const item = await ArteTvAdapter.readItemByID("120199-000-A_de");
    console.log(item);
})
