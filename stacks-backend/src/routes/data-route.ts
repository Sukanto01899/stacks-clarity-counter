import express, { Request, Response } from "express";
import { burnEvents, mintEvents, STACKS_API_BASE_URL, stats, transferEvents } from "../config";
import { parseIntOrDefault } from "../lib";
const route = express.Router();

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
