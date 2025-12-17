"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordMint = recordMint;
exports.recordTransfer = recordTransfer;
exports.recordBurn = recordBurn;
exports.buildWebhookHandler = buildWebhookHandler;
const lib_1 = require("../lib");
const config_1 = require("../config");
function recordMint(mint) {
    config_1.mintEvents.push(mint);
    config_1.stats.totalMints += 1;
    config_1.stats.activeUsers.add(mint.minter);
    if (mint.mintType === "paid")
        config_1.stats.paidMints += 1;
    if (mint.mintType === "free")
        config_1.stats.freeMints += 1;
    if (mint.mintType === "owner")
        config_1.stats.ownerMints += 1;
}
function recordTransfer(transfer) {
    config_1.transferEvents.push(transfer);
    config_1.stats.totalTransfers += 1;
    config_1.stats.activeUsers.add(transfer.from);
    config_1.stats.activeUsers.add(transfer.to);
}
function recordBurn(burn) {
    config_1.burnEvents.push(burn);
    config_1.stats.totalBurns += 1;
    config_1.stats.activeUsers.add(burn.owner);
}
function buildWebhookHandler(expectedMethod, handler) {
    return (req, res) => {
        try {
            const body = req.body;
            const payload = (0, lib_1.isChainhookEvent)(body)
                ? body.event
                : (0, lib_1.isStacksPayload)(body)
                    ? body
                    : null;
            if (!payload) {
                res.status(400).json({ error: "Invalid payload" });
                return;
            }
            const calls = (0, lib_1.extractContractCallsFromPayload)(payload, config_1.CONTRACT_IDENTIFIER).filter((c) => c.method === expectedMethod && c.success);
            for (const call of calls)
                handler(call);
            res.status(200).json({ success: true, processed: calls.length });
        }
        catch (error) {
            console.error("Webhook processing error:", error);
            res
                .status(500)
                .json({ error: (0, lib_1.getErrorMessage)(error) ?? "Internal server error" });
        }
    };
}
