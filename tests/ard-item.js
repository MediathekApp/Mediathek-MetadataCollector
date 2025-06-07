import { runTest } from "./context.js";
import { ARDMediathekAdapter } from "../bundle-test.js";

runTest(async () => {
    // const item = await ARDMediathekAdapter.readItemByID("Y3JpZDovL25kci5kZS82NGFmYWUwNi1kMWYzLTRkOGEtOTQzYi0wZDkzODRjOWQ3MGRfZ2FuemVTZW5kdW5n");
    // console.log(item);
    const item2 = await ARDMediathekAdapter.readItemByID("Y3JpZDovL3RhZ2Vzc2NoYXUuZGUvNjcwMTkwNjYtOTcxMy00ZWFkLTgzNGUtZmQwZTYwYWIxMjM1LVNFTkRVTkdTVklERU8");
    console.log(item2);
})
