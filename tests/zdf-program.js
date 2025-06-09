import { runTest } from "./context.js";
import { ZDFAdapter } from "../adapters/2-ZDF.js";

runTest(async () => {

    saveToken("api.zdf.de", "ahBaeMeekaiy5ohsai4bee4ki6Oopoi5quailieb");
    const ids = ['faszination-erde-mit-hannah-emde-dokureihe-100','heute-journal-104']
    const program = await ZDFAdapter.readProgram(ids[1]);
    console.log(program);
    
})
