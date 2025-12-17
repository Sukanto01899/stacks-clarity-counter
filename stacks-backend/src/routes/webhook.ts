import express from "express";
import { verifyAuth } from "../verifyAuth";
import {
  buildWebhookHandler,
  recordBurn,
  recordMint,
  recordTransfer,
} from "../controller/webhook";
import { randomUUID } from "crypto";
import { asString } from "../lib";

const route = express.Router();

route.post(
  "/paid-mint",
  verifyAuth,
  buildWebhookHandler("mint", (call) => {
    const [name, uri] = call.args;
    recordMint({
      tokenId: call.result || randomUUID(),
      minter: call.sender,
      name: asString(name),
      uri: asString(uri),
      mintType: "paid",
      txId: call.txId,
      blockHeight: call.blockHeight,
      timestamp: call.timestamp,
    });
  })
);
route.post(
  "/free-mint",
  verifyAuth,
  buildWebhookHandler("free-mint", (call) => {
    const [name, uri] = call.args;
    recordMint({
      tokenId: call.result || randomUUID(),
      minter: call.sender,
      name: asString(name),
      uri: asString(uri),
      mintType: "free",
      txId: call.txId,
      blockHeight: call.blockHeight,
      timestamp: call.timestamp,
    });
  })
);
route.post(
  "/owner-mint",
  verifyAuth,
  buildWebhookHandler("owner-mint", (call) => {
    const [recipient, name, uri] = call.args;
    recordMint({
      tokenId: call.result || randomUUID(),
      minter: asString(recipient) || call.sender,
      name: asString(name),
      uri: asString(uri),
      mintType: "owner",
      txId: call.txId,
      blockHeight: call.blockHeight,
      timestamp: call.timestamp,
    });
  })
);
route.post(
  "/transfer",
  verifyAuth,
  buildWebhookHandler("transfer", (call) => {
    const [tokenId, from, to] = call.args;
    recordTransfer({
      tokenId: asString(tokenId) || call.result || "unknown",
      from: asString(from),
      to: asString(to),
      txId: call.txId,
      blockHeight: call.blockHeight,
      timestamp: call.timestamp,
    });
  })
);

// Backward-compat alias (older predicates used `/webhooks/transfers`).
route.post(
  "/transfers",
  verifyAuth,
  buildWebhookHandler("transfer", (call) => {
    const [tokenId, from, to] = call.args;
    recordTransfer({
      tokenId: asString(tokenId) || call.result || "unknown",
      from: asString(from),
      to: asString(to),
      txId: call.txId,
      blockHeight: call.blockHeight,
      timestamp: call.timestamp,
    });
  })
);
route.post(
  "/burn",
  verifyAuth,
  buildWebhookHandler("burn", (call) => {
    const [tokenId] = call.args;
    recordBurn({
      tokenId: asString(tokenId) || call.result || "unknown",
      owner: call.sender,
      txId: call.txId,
      blockHeight: call.blockHeight,
      timestamp: call.timestamp,
    });
  })
);

export default route;
