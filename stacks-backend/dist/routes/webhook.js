"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const verifyAuth_1 = require("../verifyAuth");
const webhook_1 = require("../controller/webhook");
const crypto_1 = require("crypto");
const lib_1 = require("../lib");
const route = express_1.default.Router();
route.post("/paid-mint", verifyAuth_1.verifyAuth, (0, webhook_1.buildWebhookHandler)("mint", (call) => {
    const [name, uri] = call.args;
    (0, webhook_1.recordMint)({
        tokenId: call.result || (0, crypto_1.randomUUID)(),
        minter: call.sender,
        name: (0, lib_1.asString)(name),
        uri: (0, lib_1.asString)(uri),
        mintType: "paid",
        txId: call.txId,
        blockHeight: call.blockHeight,
        timestamp: call.timestamp,
    });
}));
route.post("/free-mint", verifyAuth_1.verifyAuth, (0, webhook_1.buildWebhookHandler)("free-mint", (call) => {
    const [name, uri] = call.args;
    (0, webhook_1.recordMint)({
        tokenId: call.result || (0, crypto_1.randomUUID)(),
        minter: call.sender,
        name: (0, lib_1.asString)(name),
        uri: (0, lib_1.asString)(uri),
        mintType: "free",
        txId: call.txId,
        blockHeight: call.blockHeight,
        timestamp: call.timestamp,
    });
}));
route.post("/owner-mint", verifyAuth_1.verifyAuth, (0, webhook_1.buildWebhookHandler)("owner-mint", (call) => {
    const [recipient, name, uri] = call.args;
    (0, webhook_1.recordMint)({
        tokenId: call.result || (0, crypto_1.randomUUID)(),
        minter: (0, lib_1.asString)(recipient) || call.sender,
        name: (0, lib_1.asString)(name),
        uri: (0, lib_1.asString)(uri),
        mintType: "owner",
        txId: call.txId,
        blockHeight: call.blockHeight,
        timestamp: call.timestamp,
    });
}));
route.post("/transfer", verifyAuth_1.verifyAuth, (0, webhook_1.buildWebhookHandler)("transfer", (call) => {
    const [tokenId, from, to] = call.args;
    (0, webhook_1.recordTransfer)({
        tokenId: (0, lib_1.asString)(tokenId) || call.result || "unknown",
        from: (0, lib_1.asString)(from),
        to: (0, lib_1.asString)(to),
        txId: call.txId,
        blockHeight: call.blockHeight,
        timestamp: call.timestamp,
    });
}));
// Backward-compat alias (older predicates used `/webhooks/transfers`).
route.post("/transfers", verifyAuth_1.verifyAuth, (0, webhook_1.buildWebhookHandler)("transfer", (call) => {
    const [tokenId, from, to] = call.args;
    (0, webhook_1.recordTransfer)({
        tokenId: (0, lib_1.asString)(tokenId) || call.result || "unknown",
        from: (0, lib_1.asString)(from),
        to: (0, lib_1.asString)(to),
        txId: call.txId,
        blockHeight: call.blockHeight,
        timestamp: call.timestamp,
    });
}));
route.post("/burn", verifyAuth_1.verifyAuth, (0, webhook_1.buildWebhookHandler)("burn", (call) => {
    const [tokenId] = call.args;
    (0, webhook_1.recordBurn)({
        tokenId: (0, lib_1.asString)(tokenId) || call.result || "unknown",
        owner: call.sender,
        txId: call.txId,
        blockHeight: call.blockHeight,
        timestamp: call.timestamp,
    });
}));
exports.default = route;
