import { runTest } from "./context.js";
import { ArteTvAdapter } from "../bundle-test.js";

runTest(async () => {
    const item = await ArteTvAdapter.readItemByID("120199-000-A_de");
    console.log(item);
})
