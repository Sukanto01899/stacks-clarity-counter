import { RequestHandler } from "express";
import {
  BurnEvent,
  ContractCallMatch,
  MintEvent,
  TransferEvent,
} from "../types";
import {
  extractContractCallsFromPayload,
  getErrorMessage,
  isChainhookEvent,
  isStacksPayload,
} from "../lib";
import { StacksPayload } from "@hirosystems/chainhook-client";
import {
  burnEvents,
  CONTRACT_IDENTIFIER,
  mintEvents,
  stats,
  transferEvents,
} from "../config";

export function recordMint(mint: MintEvent) {
  mintEvents.push(mint);
  stats.totalMints += 1;
  stats.activeUsers.add(mint.minter);
  if (mint.mintType === "paid") stats.paidMints += 1;
  if (mint.mintType === "free") stats.freeMints += 1;
  if (mint.mintType === "owner") stats.ownerMints += 1;
}

export function recordTransfer(transfer: TransferEvent) {
  transferEvents.push(transfer);
  stats.totalTransfers += 1;
  stats.activeUsers.add(transfer.from);
  stats.activeUsers.add(transfer.to);
}

export function recordBurn(burn: BurnEvent) {
  burnEvents.push(burn);
  stats.totalBurns += 1;
  stats.activeUsers.add(burn.owner);
}

export function buildWebhookHandler(
  expectedMethod: string,
  handler: (call: ContractCallMatch) => void
): RequestHandler {
  return (req, res) => {
    try {
      const body: unknown = req.body;
      const payload = isChainhookEvent(body)
        ? (body.event as unknown as StacksPayload)
        : isStacksPayload(body)
        ? body
        : null;

      if (!payload) {
        res.status(400).json({ error: "Invalid payload" });
        return;
      }

      const calls = extractContractCallsFromPayload(
        payload,
        CONTRACT_IDENTIFIER
      ).filter((c) => c.method === expectedMethod && c.success);

      for (const call of calls) handler(call);

      res.status(200).json({ success: true, processed: calls.length });
    } catch (error: unknown) {
      console.error("Webhook processing error:", error);
      res
        .status(500)
        .json({ error: getErrorMessage(error) ?? "Internal server error" });
    }
  };
}
