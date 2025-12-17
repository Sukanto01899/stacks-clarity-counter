import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;

const BLOCKS_PER_DAY = 144;

describe("Daily Check-in Contract", () => {
  it("ensures simnet is initialized", () => {
    expect(simnet.blockHeight).toBeDefined();
  });

  it("allows first time check-in", () => {
    const { result } = simnet.callPublicFn(
      "daily-checkin",
      "check-in",
      [],
      address1
    );

    expect(result).toBeOk(Cl.bool(true));
  });

  it("prevents double check-in on same day", () => {
    // First check-in
    simnet.callPublicFn("daily-checkin", "check-in", [], address1);

    // Try again immediately
    const { result } = simnet.callPublicFn(
      "daily-checkin",
      "check-in",
      [],
      address1
    );

    expect(result).toBeErr(Cl.uint(100)); // ERR-ALREADY-CHECKED-IN
  });

  it("allows check-in after 144 blocks", () => {
    // First check-in
    simnet.callPublicFn("daily-checkin", "check-in", [], address1);

    // Wait 144 blocks
    simnet.mineEmptyBlocks(BLOCKS_PER_DAY);

    // Second check-in
    const { result } = simnet.callPublicFn(
      "daily-checkin",
      "check-in",
      [],
      address1
    );

    expect(result).toBeOk(Cl.bool(true));
  });

  it("maintains streak for consecutive days", () => {
    // Day 1
    simnet.callPublicFn("daily-checkin", "check-in", [], address1);

    // Day 2
    simnet.mineEmptyBlocks(BLOCKS_PER_DAY);
    simnet.callPublicFn("daily-checkin", "check-in", [], address1);

    // Day 3
    simnet.mineEmptyBlocks(BLOCKS_PER_DAY);
    simnet.callPublicFn("daily-checkin", "check-in", [], address1);

    // Check streak
    const { result } = simnet.callReadOnlyFn(
      "daily-checkin",
      "get-current-streak",
      [Cl.principal(address1)],
      address1
    );

    expect(result).toBeOk(Cl.uint(3));
  });

  it("resets streak after missing 2+ days", () => {
    // Day 1 & 2
    simnet.callPublicFn("daily-checkin", "check-in", [], address1);
    simnet.mineEmptyBlocks(BLOCKS_PER_DAY);
    simnet.callPublicFn("daily-checkin", "check-in", [], address1);

    // Skip 3 days
    simnet.mineEmptyBlocks(BLOCKS_PER_DAY * 3);
    simnet.callPublicFn("daily-checkin", "check-in", [], address1);

    // Current streak should be 1
    const { result: currentStreak } = simnet.callReadOnlyFn(
      "daily-checkin",
      "get-current-streak",
      [Cl.principal(address1)],
      address1
    );
    expect(currentStreak).toBeOk(Cl.uint(1));

    // Longest streak should still be 2
    const { result: longestStreak } = simnet.callReadOnlyFn(
      "daily-checkin",
      "get-longest-streak",
      [Cl.principal(address1)],
      address1
    );
    expect(longestStreak).toBeOk(Cl.uint(2));
  });

  it("counts total checkins correctly", () => {
    // Two users check in
    simnet.callPublicFn("daily-checkin", "check-in", [], address1);
    simnet.callPublicFn("daily-checkin", "check-in", [], address2);

    const { result } = simnet.callReadOnlyFn(
      "daily-checkin",
      "get-total-checkins",
      [],
      address1
    );

    expect(result).toBeOk(Cl.uint(2));
  });

  it("can-check-in returns true for new user", () => {
    const { result } = simnet.callReadOnlyFn(
      "daily-checkin",
      "can-check-in",
      [Cl.principal(address1)],
      address1
    );

    expect(result).toBeOk(Cl.bool(true));
  });

  it("can-check-in returns false after check-in", () => {
    simnet.callPublicFn("daily-checkin", "check-in", [], address1);

    const { result } = simnet.callReadOnlyFn(
      "daily-checkin",
      "can-check-in",
      [Cl.principal(address1)],
      address1
    );

    expect(result).toBeOk(Cl.bool(false));
  });

  it("blocks-until-next-checkin calculates correctly", () => {
    simnet.callPublicFn("daily-checkin", "check-in", [], address1);

    const { result } = simnet.callReadOnlyFn(
      "daily-checkin",
      "blocks-until-next-checkin",
      [Cl.principal(address1)],
      address1
    );

    expect(result).toBeOk(Cl.uint(144)); // Full 144 blocks needed
  });

  it("maintains independent streaks for multiple users", () => {
    // User 1 checks in Day 1
    simnet.callPublicFn("daily-checkin", "check-in", [], address1);

    // Wait half day
    simnet.mineEmptyBlocks(72);

    // User 2 checks in
    simnet.callPublicFn("daily-checkin", "check-in", [], address2);

    // Wait another half day
    simnet.mineEmptyBlocks(72);

    // User 1 can check in (Day 2)
    const result1 = simnet.callPublicFn(
      "daily-checkin",
      "check-in",
      [],
      address1
    );
    expect(result1.result).toBeOk(Cl.bool(true));

    // User 2 cannot yet (only 72 blocks passed)
    const result2 = simnet.callPublicFn(
      "daily-checkin",
      "check-in",
      [],
      address2
    );
    expect(result2.result).toBeErr(Cl.uint(100));
  });
});
