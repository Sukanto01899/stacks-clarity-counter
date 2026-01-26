import express, { Request, Response } from "express";
import {
  burnEvents,
  FAUCET_ADDRESS,
  FAUCET_ALLOW_MAINNET,
  FAUCET_AMOUNT_STX,
  FAUCET_COOLDOWN_MINUTES,
  FAUCET_ENABLED,
  FAUCET_IP_COOLDOWN_MINUTES,
  FAUCET_PRIVATE_KEY,
  mintEvents,
  STACKS_API_BASE_URL,
  STACKS_NETWORK,
  stats,
  transferEvents,
} from "../config";
import { asString, parseIntOrDefault } from "../lib";
import {
  AnchorMode,
  PostConditionMode,
  broadcastTransaction,
  makeSTXTokenTransfer,
  validateStacksAddress,
} from "@stacks/transactions";
import { StacksMainnet, StacksTestnet } from "@stacks/network";
const route = express.Router();

const faucetByAddress = new Map<string, number>();
const faucetByIp = new Map<string, number>();

function getClientIp(req: Request): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0] ?? "";
  }
  return req.socket?.remoteAddress ?? "";
}

function stxToMicrostx(amount: string): bigint {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Invalid STX amount");
  }

  const [whole, fraction = ""] = trimmed.split(".");
  const paddedFraction = (fraction + "000000").slice(0, 6);
  return BigInt(whole) * 1_000_000n + BigInt(paddedFraction);
}

route.get("/stats", (_req: Request, res: Response) => {
  res.json({
    totalMints: stats.totalMints,
    paidMints: stats.paidMints,
    freeMints: stats.freeMints,
    ownerMints: stats.ownerMints,
    totalTransfers: stats.totalTransfers,
    totalBurns: stats.totalBurns,
    activeUsers: stats.activeUsers.size,
  });
});

route.get("/mints", (req: Request, res: Response) => {
  const limit = parseIntOrDefault(req.query.limit as string | undefined, 50);
  const offset = parseIntOrDefault(req.query.offset as string | undefined, 0);

  const data = [...mintEvents]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(offset, offset + limit);

  res.json({
    total: mintEvents.length,
    limit,
    offset,
    data,
  });
});

route.get("/transfers", (req: Request, res: Response) => {
  const limit = parseIntOrDefault(req.query.limit as string | undefined, 50);
  const offset = parseIntOrDefault(req.query.offset as string | undefined, 0);

  const data = [...transferEvents]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(offset, offset + limit);

  res.json({
    total: transferEvents.length,
    limit,
    offset,
    data,
  });
});

route.get("/activity/recent", (req: Request, res: Response) => {
  const limit = parseIntOrDefault(req.query.limit as string | undefined, 20);

  const activity = [
    ...mintEvents.map((m) => ({ ...m, type: "mint" as const })),
    ...transferEvents.map((t) => ({ ...t, type: "transfer" as const })),
    ...burnEvents.map((b) => ({ ...b, type: "burn" as const })),
  ]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);

  res.json(activity);
});

route.get("/user/:address", (req: Request, res: Response) => {
  const address = req.params.address;

  const userMints = mintEvents.filter((m) => m.minter === address);
  const userTransfers = transferEvents.filter(
    (t) => t.from === address || t.to === address
  );
  const userBurns = burnEvents.filter((b) => b.owner === address);

  res.json({
    address,
    totalMints: userMints.length,
    totalTransfers: userTransfers.length,
    totalBurns: userBurns.length,
    mints: userMints,
    transfers: userTransfers,
    burns: userBurns,
  });
});

route.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: Date.now(),
  });
});

// Faucet status (safe to expose)
route.get("/faucet/status", (_req: Request, res: Response) => {
  res.json({
    enabled: FAUCET_ENABLED,
    network: STACKS_NETWORK,
    address: FAUCET_ADDRESS,
    amountStx: FAUCET_AMOUNT_STX,
    cooldownMinutes: FAUCET_COOLDOWN_MINUTES,
  });
});

// Faucet claim endpoint
route.post("/faucet/claim", async (req: Request, res: Response) => {
  if (!FAUCET_ENABLED) {
    res.status(503).json({ error: "Faucet is disabled" });
    return;
  }

  if (STACKS_NETWORK === "mainnet" && !FAUCET_ALLOW_MAINNET) {
    res.status(403).json({ error: "Faucet is not enabled on mainnet" });
    return;
  }

  if (!FAUCET_PRIVATE_KEY) {
    res.status(500).json({ error: "Faucet is not configured" });
    return;
  }

  const address = asString(req.body?.address).trim();
  if (!address) {
    res.status(400).json({ error: "Address is required" });
    return;
  }

  if (!validateStacksAddress(address)) {
    res.status(400).json({ error: "Invalid Stacks address" });
    return;
  }

  const now = Date.now();
  const cooldownMs = FAUCET_COOLDOWN_MINUTES * 60_000;
  const lastClaim = faucetByAddress.get(address) ?? 0;
  if (now - lastClaim < cooldownMs) {
    res.status(429).json({
      error: "Address cooldown active",
      nextEligibleAt: lastClaim + cooldownMs,
    });
    return;
  }

  const clientIp = getClientIp(req);
  if (clientIp) {
    const ipCooldownMs = FAUCET_IP_COOLDOWN_MINUTES * 60_000;
    const lastIpClaim = faucetByIp.get(clientIp) ?? 0;
    if (now - lastIpClaim < ipCooldownMs) {
      res.status(429).json({
        error: "IP cooldown active",
        nextEligibleAt: lastIpClaim + ipCooldownMs,
      });
      return;
    }
  }

  let amountMicrostx: bigint;
  try {
    amountMicrostx = stxToMicrostx(FAUCET_AMOUNT_STX);
  } catch (error) {
    res.status(500).json({ error: "Invalid faucet amount configuration" });
    return;
  }

  if (amountMicrostx <= 0n) {
    res.status(500).json({ error: "Invalid faucet amount configuration" });
    return;
  }

  const network =
    STACKS_NETWORK === "mainnet" ? new StacksMainnet() : new StacksTestnet();

  try {
    const tx = await makeSTXTokenTransfer({
      recipient: address,
      amount: amountMicrostx,
      senderKey: FAUCET_PRIVATE_KEY,
      network,
      memo: "Faucet",
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
    });

    const result = await broadcastTransaction(tx, network);
    if ("error" in result) {
      res.status(400).json({
        error: "Failed to broadcast transaction",
        details: result,
      });
      return;
    }

    faucetByAddress.set(address, now);
    if (clientIp) faucetByIp.set(clientIp, now);

    res.json({
      txId: result.txid,
      amountStx: FAUCET_AMOUNT_STX,
      cooldownMinutes: FAUCET_COOLDOWN_MINUTES,
      nextEligibleAt: now + cooldownMs,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to send faucet transaction",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Convenience endpoint: fetch tx details from Hiro Stacks API (testnet/mainnet based on config)
route.get("/stacks/tx/:txid", async (req: Request, res: Response) => {
  const txid = req.params.txid;
  try {
    const response = await fetch(
      `${STACKS_API_BASE_URL}/extended/v1/tx/${encodeURIComponent(txid)}`,
      { headers: { accept: "application/json" } }
    );

    const text = await response.text();
    if (!response.ok) {
      res.status(response.status).send(text);
      return;
    }

    res.type("application/json").send(text);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tx", message: String(error) });
  }
});

export default route;
