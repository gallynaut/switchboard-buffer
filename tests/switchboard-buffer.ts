import {getRunner} from "./common";
import {setupTest} from "./sdk";

describe("switchboard-buffer", () => {
  it("turn crank and push buffer", async () => {

    const runner = await getRunner({
      crank:true,
      queue:true,
      aggregator:true,
      switchboardToken:true
    });

    await setupTest({
      runner,
      turnCrankAction: true,
      pushBufferAction:true
    });
  });
});
