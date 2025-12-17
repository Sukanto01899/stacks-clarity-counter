import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

describe("Bitcoin Stamp NFT Tests", () => {
  it("ensures simnet is well initialised", () => {
    expect(simnet.blockHeight).toBeDefined();
  });

  it("gets initial contract data", () => {
    const { result: totalSupply } = simnet.callReadOnlyFn(
      "bitcoin-stamp-nft",
      "get-total-supply",
      [],
      deployer
    );
    expect(totalSupply).toBeOk(Cl.uint(0));

    const { result: maxSupply } = simnet.callReadOnlyFn(
      "bitcoin-stamp-nft",
      "get-max-supply",
      [],
      deployer
    );
    expect(maxSupply).toBeOk(Cl.uint(10000));

    const { result: mintPrice } = simnet.callReadOnlyFn(
      "bitcoin-stamp-nft",
      "get-mint-price",
      [],
      deployer
    );
    expect(mintPrice).toBeOk(Cl.uint(1000000));

    const { result: mintEnabled } = simnet.callReadOnlyFn(
      "bitcoin-stamp-nft",
      "is-mint-enabled",
      [],
      deployer
    );
    expect(mintEnabled).toBeOk(Cl.bool(true));
  });

  it("allows free mint for wallet", () => {
    const { result } = simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "free-mint",
      [Cl.stringAscii("Bitcoin Stamp #1"), Cl.stringAscii("ipfs://QmTest123")],
      wallet1
    );
    expect(result).toBeOk(Cl.uint(1));

    const { result: totalSupply } = simnet.callReadOnlyFn(
      "bitcoin-stamp-nft",
      "get-total-supply",
      [],
      wallet1
    );
    expect(totalSupply).toBeOk(Cl.uint(1));
  });

  it("allows unlimited free mints from same wallet", () => {
    const { result: mint1 } = simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "free-mint",
      [Cl.stringAscii("Bitcoin Stamp #1"), Cl.stringAscii("ipfs://QmTest123")],
      wallet1
    );
    expect(mint1).toBeOk(Cl.uint(1));

    const { result: mint2 } = simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "free-mint",
      [Cl.stringAscii("Bitcoin Stamp #2"), Cl.stringAscii("ipfs://QmTest456")],
      wallet1
    );
    expect(mint2).toBeOk(Cl.uint(2));

    const { result: mint3 } = simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "free-mint",
      [Cl.stringAscii("Bitcoin Stamp #3"), Cl.stringAscii("ipfs://QmTest789")],
      wallet1
    );
    expect(mint3).toBeOk(Cl.uint(3));

    const { result: totalSupply } = simnet.callReadOnlyFn(
      "bitcoin-stamp-nft",
      "get-total-supply",
      [],
      wallet1
    );
    expect(totalSupply).toBeOk(Cl.uint(3));
  });

  it("allows different wallets to free mint", () => {
    simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "free-mint",
      [Cl.stringAscii("Bitcoin Stamp #1"), Cl.stringAscii("ipfs://QmTest123")],
      wallet1
    );

    const { result } = simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "free-mint",
      [Cl.stringAscii("Bitcoin Stamp #2"), Cl.stringAscii("ipfs://QmTest456")],
      wallet2
    );
    expect(result).toBeOk(Cl.uint(2));
  });

  it("validates empty name input", () => {
    const { result } = simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "free-mint",
      [Cl.stringAscii(""), Cl.stringAscii("ipfs://QmTest123")],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(413)); // ERR-INVALID-INPUT
  });

  it("validates empty uri input", () => {
    const { result } = simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "free-mint",
      [Cl.stringAscii("Bitcoin Stamp #1"), Cl.stringAscii("")],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(413)); // ERR-INVALID-INPUT
  });

  it("gets token metadata after minting", () => {
    simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "free-mint",
      [Cl.stringAscii("Bitcoin Stamp #1"), Cl.stringAscii("ipfs://QmTest123")],
      wallet1
    );

    const { result } = simnet.callReadOnlyFn(
      "bitcoin-stamp-nft",
      "get-token-metadata",
      [Cl.uint(1)],
      wallet1
    );

    const metadata = Cl.tuple({
      name: Cl.stringAscii("Bitcoin Stamp #1"),
      uri: Cl.stringAscii("ipfs://QmTest123"),
      "minted-at": Cl.uint(simnet.blockHeight),
    });

    expect(result).toBeOk(Cl.some(metadata));
  });

  it("gets token owner", () => {
    simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "free-mint",
      [Cl.stringAscii("Bitcoin Stamp #1"), Cl.stringAscii("ipfs://QmTest123")],
      wallet1
    );

    const { result } = simnet.callReadOnlyFn(
      "bitcoin-stamp-nft",
      "get-owner",
      [Cl.uint(1)],
      wallet1
    );
    expect(result).toBeOk(Cl.some(Cl.principal(wallet1)));
  });

  it("allows owner to mint to any recipient", () => {
    const { result } = simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "owner-mint",
      [
        Cl.principal(wallet2),
        Cl.stringAscii("Admin Stamp"),
        Cl.stringAscii("ipfs://QmAdmin123"),
      ],
      deployer
    );
    expect(result).toBeOk(Cl.uint(1));

    const { result: owner } = simnet.callReadOnlyFn(
      "bitcoin-stamp-nft",
      "get-owner",
      [Cl.uint(1)],
      deployer
    );
    expect(owner).toBeOk(Cl.some(Cl.principal(wallet2)));
  });

  it("prevents non-owner from using owner-mint", () => {
    const { result } = simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "owner-mint",
      [
        Cl.principal(wallet2),
        Cl.stringAscii("Admin Stamp"),
        Cl.stringAscii("ipfs://QmAdmin123"),
      ],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(401)); // ERR-NOT-AUTHORIZED
  });

  it("allows NFT transfer", () => {
    simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "free-mint",
      [Cl.stringAscii("Bitcoin Stamp #1"), Cl.stringAscii("ipfs://QmTest123")],
      wallet1
    );

    const { result } = simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "transfer",
      [Cl.uint(1), Cl.principal(wallet1), Cl.principal(wallet2)],
      wallet1
    );
    expect(result).toBeOk(Cl.bool(true));

    const { result: newOwner } = simnet.callReadOnlyFn(
      "bitcoin-stamp-nft",
      "get-owner",
      [Cl.uint(1)],
      wallet1
    );
    expect(newOwner).toBeOk(Cl.some(Cl.principal(wallet2)));
  });

  it("prevents unauthorized transfer", () => {
    simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "free-mint",
      [Cl.stringAscii("Bitcoin Stamp #1"), Cl.stringAscii("ipfs://QmTest123")],
      wallet1
    );

    const { result } = simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "transfer",
      [Cl.uint(1), Cl.principal(wallet1), Cl.principal(wallet2)],
      wallet2
    );
    expect(result).toBeErr(Cl.uint(401)); // ERR-NOT-AUTHORIZED
  });

  it("allows NFT burn by owner", () => {
    simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "free-mint",
      [Cl.stringAscii("Bitcoin Stamp #1"), Cl.stringAscii("ipfs://QmTest123")],
      wallet1
    );

    const { result } = simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "burn",
      [Cl.uint(1)],
      wallet1
    );
    expect(result).toBeOk(Cl.bool(true));

    const { result: owner } = simnet.callReadOnlyFn(
      "bitcoin-stamp-nft",
      "get-owner",
      [Cl.uint(1)],
      wallet1
    );
    expect(owner).toBeOk(Cl.none());
  });

  it("prevents unauthorized burn", () => {
    simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "free-mint",
      [Cl.stringAscii("Bitcoin Stamp #1"), Cl.stringAscii("ipfs://QmTest123")],
      wallet1
    );

    const { result } = simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "burn",
      [Cl.uint(1)],
      wallet2
    );
    expect(result).toBeErr(Cl.uint(401)); // ERR-NOT-AUTHORIZED
  });

  it("allows owner to toggle mint enabled", () => {
    const { result } = simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "toggle-mint-enabled",
      [],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));

    const { result: mintEnabled } = simnet.callReadOnlyFn(
      "bitcoin-stamp-nft",
      "is-mint-enabled",
      [],
      deployer
    );
    expect(mintEnabled).toBeOk(Cl.bool(false));
  });

  it("prevents minting when disabled", () => {
    simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "toggle-mint-enabled",
      [],
      deployer
    );

    const { result } = simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "free-mint",
      [Cl.stringAscii("Bitcoin Stamp #1"), Cl.stringAscii("ipfs://QmTest123")],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(401)); // ERR-NOT-AUTHORIZED
  });

  it("allows owner to update base URI", () => {
    const { result } = simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "set-base-uri",
      [Cl.stringAscii("https://new-uri.com/")],
      deployer
    );
    expect(result).toBeOk(Cl.bool(true));

    const { result: baseUri } = simnet.callReadOnlyFn(
      "bitcoin-stamp-nft",
      "get-base-uri",
      [],
      deployer
    );
    expect(baseUri).toBeOk(Cl.stringAscii("https://new-uri.com/"));
  });

  it("prevents non-owner from updating base URI", () => {
    const { result } = simnet.callPublicFn(
      "bitcoin-stamp-nft",
      "set-base-uri",
      [Cl.stringAscii("https://new-uri.com/")],
      wallet1
    );
    expect(result).toBeErr(Cl.uint(401)); // ERR-NOT-AUTHORIZED
  });
});
