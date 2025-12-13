import { Cl, ClarityType } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const user1 = accounts.get("wallet_1")!;

describe("Simple Counter Contract", () => {
  it("increments counter twice in the same test", () => {
    simnet.mineEmptyBurnBlocks(1);

    simnet.callPublicFn("message-board", "increment", [], user1);
    simnet.callPublicFn("message-board", "increment", [], user1);

    const res = simnet.callReadOnlyFn(
      "message-board",
      "get-counter",
      [],
      deployer
    );

    expect(res.result).toBeUint(2);
  });
});
