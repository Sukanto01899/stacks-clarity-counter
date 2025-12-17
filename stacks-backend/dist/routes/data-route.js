"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const config_1 = require("../config");
const lib_1 = require("../lib");
const route = express_1.default.Router();
route.get("/stats", (_req, res) => {
    res.json({
        totalMints: config_1.stats.totalMints,
        paidMints: config_1.stats.paidMints,
        freeMints: config_1.stats.freeMints,
        ownerMints: config_1.stats.ownerMints,
        totalTransfers: config_1.stats.totalTransfers,
        totalBurns: config_1.stats.totalBurns,
        activeUsers: config_1.stats.activeUsers.size,
    });
});
route.get("/mints", (req, res) => {
    const limit = (0, lib_1.parseIntOrDefault)(req.query.limit, 50);
    const offset = (0, lib_1.parseIntOrDefault)(req.query.offset, 0);
    const data = [...config_1.mintEvents]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(offset, offset + limit);
    res.json({
        total: config_1.mintEvents.length,
        limit,
        offset,
        data,
    });
});
route.get("/transfers", (req, res) => {
    const limit = (0, lib_1.parseIntOrDefault)(req.query.limit, 50);
    const offset = (0, lib_1.parseIntOrDefault)(req.query.offset, 0);
    const data = [...config_1.transferEvents]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(offset, offset + limit);
    res.json({
        total: config_1.transferEvents.length,
        limit,
        offset,
        data,
    });
});
route.get("/activity/recent", (req, res) => {
    const limit = (0, lib_1.parseIntOrDefault)(req.query.limit, 20);
    const activity = [
        ...config_1.mintEvents.map((m) => ({ ...m, type: "mint" })),
        ...config_1.transferEvents.map((t) => ({ ...t, type: "transfer" })),
        ...config_1.burnEvents.map((b) => ({ ...b, type: "burn" })),
    ]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
    res.json(activity);
});
route.get("/user/:address", (req, res) => {
    const address = req.params.address;
    const userMints = config_1.mintEvents.filter((m) => m.minter === address);
    const userTransfers = config_1.transferEvents.filter((t) => t.from === address || t.to === address);
    const userBurns = config_1.burnEvents.filter((b) => b.owner === address);
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
route.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        timestamp: Date.now(),
    });
});
// Convenience endpoint: fetch tx details from Hiro Stacks API (testnet/mainnet based on config)
route.get("/stacks/tx/:txid", async (req, res) => {
    const txid = req.params.txid;
    try {
        const response = await fetch(`${config_1.STACKS_API_BASE_URL}/extended/v1/tx/${encodeURIComponent(txid)}`, { headers: { accept: "application/json" } });
        const text = await response.text();
        if (!response.ok) {
            res.status(response.status).send(text);
            return;
        }
        res.type("application/json").send(text);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch tx", message: String(error) });
    }
});
exports.default = route;
