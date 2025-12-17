import { StacksPayload } from "@hirosystems/chainhook-client";
import { ChainhookEvent } from "@hirosystems/chainhooks-client";
import { ContractCallMatch } from "./types";

export function parseIntOrDefault(
  value: string | undefined,
  fallback: number
): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string") return maybeMessage;
  }
  return undefined;
}

export function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

export function isStacksPayload(payload: unknown): payload is StacksPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "apply" in payload &&
    Array.isArray((payload as { apply?: unknown }).apply)
  );
}

export function isChainhookEvent(payload: unknown): payload is ChainhookEvent {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "event" in payload &&
    typeof (payload as { event?: unknown }).event === "object" &&
    (payload as { event?: unknown }).event !== null &&
    "apply" in (payload as { event: { apply?: unknown } }).event &&
    Array.isArray((payload as { event: { apply?: unknown } }).event.apply)
  );
}

export function extractContractCallsFromPayload(
  payload: StacksPayload,
  contractIdentifier: string
): ContractCallMatch[] {
  const matches: ContractCallMatch[] = [];

  for (const block of payload.apply) {
    const blockHeight = block.block_identifier.index;
    const blockTimestamp = block.timestamp;

    for (const tx of block.transactions) {
      // Local chainhook-client payload shape
      if (
        typeof (tx as unknown as { metadata?: { kind?: { type?: unknown } } })
          ?.metadata?.kind?.type === "string" &&
        (tx as unknown as { metadata: { kind: { type: string } } }).metadata.kind
          .type === "ContractCall"
      ) {
        const localTx = tx as unknown as {
          transaction_identifier: { hash: string };
          metadata: {
            sender: string;
            success: boolean;
            result: string;
            kind: {
              data: { contract_identifier: string; method: string; args: string[] };
              type: string;
            };
          };
        };

        if (localTx.metadata.kind.data.contract_identifier !== contractIdentifier)
          continue;

        matches.push({
          txId: localTx.transaction_identifier.hash,
          blockHeight,
          timestamp: blockTimestamp,
          sender: localTx.metadata.sender,
          method: localTx.metadata.kind.data.method,
          args: localTx.metadata.kind.data.args,
          result: localTx.metadata.result,
          success: localTx.metadata.success,
        });
        continue;
      }

      // Hiro Chainhooks payload shape (chainhooks-client): tx.metadata.type + operations[*].type === 'contract_call'
      const txType = (tx as unknown as { metadata?: { type?: unknown } })?.metadata
        ?.type;
      if (txType !== "contract_call") continue;

      const operations = (
        tx as unknown as { operations?: unknown }
      )?.operations;
      if (!Array.isArray(operations)) continue;

      const contractCallOp = operations.find((op: unknown) => {
        const o = op as {
          type?: unknown;
          metadata?: { contract_identifier?: unknown; function_name?: unknown; args?: unknown };
        };
        return (
          o.type === "contract_call" &&
          typeof o.metadata?.contract_identifier === "string" &&
          o.metadata.contract_identifier === contractIdentifier
        );
      });

      if (!contractCallOp) continue;

      const functionName = (
        contractCallOp as {
          metadata?: { function_name?: unknown; args?: unknown; contract_identifier?: unknown };
        }
      )?.metadata?.function_name;
      if (typeof functionName !== "string") continue;

      const rawArgs = (
        contractCallOp as { metadata?: { args?: unknown } }
      )?.metadata?.args;
      const args: string[] = Array.isArray(rawArgs)
        ? rawArgs.map((a: unknown) => {
            const arg = a as { repr?: unknown };
            return typeof arg.repr === "string" ? arg.repr : String(a);
          })
        : typeof rawArgs === "string"
          ? [rawArgs]
          : [];

      const sender = (
        tx as unknown as { metadata?: { sender_address?: unknown } }
      )?.metadata?.sender_address;
      const result = (
        tx as unknown as { metadata?: { result?: unknown } }
      )?.metadata?.result;
      let resultString = "";
      if (typeof result === "string") {
        resultString = result;
      } else if (typeof result === "object" && result !== null && "repr" in result) {
        const repr = (result as { repr?: unknown }).repr;
        if (typeof repr === "string") resultString = repr;
      }

      const status = (
        tx as unknown as { metadata?: { status?: unknown } }
      )?.metadata?.status;
      const success = status === "success";

      matches.push({
        txId: (tx as unknown as { transaction_identifier: { hash: string } })
          .transaction_identifier.hash,
        blockHeight,
        timestamp: blockTimestamp,
        sender: typeof sender === "string" ? sender : "",
        method: functionName,
        args,
        result: resultString,
        success,
      });
    }
  }

  return matches;
}
