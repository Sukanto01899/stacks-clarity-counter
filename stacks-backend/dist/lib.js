"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIntOrDefault = parseIntOrDefault;
exports.getErrorMessage = getErrorMessage;
exports.asString = asString;
exports.isStacksPayload = isStacksPayload;
exports.isChainhookEvent = isChainhookEvent;
exports.extractContractCallsFromPayload = extractContractCallsFromPayload;
function parseIntOrDefault(value, fallback) {
    if (!value)
        return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function getErrorMessage(error) {
    if (error instanceof Error)
        return error.message;
    if (typeof error === "string")
        return error;
    if (typeof error === "object" && error !== null && "message" in error) {
        const maybeMessage = error.message;
        if (typeof maybeMessage === "string")
            return maybeMessage;
    }
    return undefined;
}
function asString(value) {
    if (typeof value === "string")
        return value;
    if (value == null)
        return "";
    return String(value);
}
function isStacksPayload(payload) {
    return (typeof payload === "object" &&
        payload !== null &&
        "apply" in payload &&
        Array.isArray(payload.apply));
}
function isChainhookEvent(payload) {
    return (typeof payload === "object" &&
        payload !== null &&
        "event" in payload &&
        typeof payload.event === "object" &&
        payload.event !== null &&
        "apply" in payload.event &&
        Array.isArray(payload.event.apply));
}
function extractContractCallsFromPayload(payload, contractIdentifier) {
    const matches = [];
    for (const block of payload.apply) {
        const blockHeight = block.block_identifier.index;
        const blockTimestamp = block.timestamp;
        for (const tx of block.transactions) {
            // Local chainhook-client payload shape
            if (typeof tx
                ?.metadata?.kind?.type === "string" &&
                tx.metadata.kind
                    .type === "ContractCall") {
                const localTx = tx;
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
            const txType = tx?.metadata
                ?.type;
            if (txType !== "contract_call")
                continue;
            const operations = tx?.operations;
            if (!Array.isArray(operations))
                continue;
            const contractCallOp = operations.find((op) => {
                const o = op;
                return (o.type === "contract_call" &&
                    typeof o.metadata?.contract_identifier === "string" &&
                    o.metadata.contract_identifier === contractIdentifier);
            });
            if (!contractCallOp)
                continue;
            const functionName = contractCallOp?.metadata?.function_name;
            if (typeof functionName !== "string")
                continue;
            const rawArgs = contractCallOp?.metadata?.args;
            const args = Array.isArray(rawArgs)
                ? rawArgs.map((a) => {
                    const arg = a;
                    return typeof arg.repr === "string" ? arg.repr : String(a);
                })
                : typeof rawArgs === "string"
                    ? [rawArgs]
                    : [];
            const sender = tx?.metadata?.sender_address;
            const result = tx?.metadata?.result;
            let resultString = "";
            if (typeof result === "string") {
                resultString = result;
            }
            else if (typeof result === "object" && result !== null && "repr" in result) {
                const repr = result.repr;
                if (typeof repr === "string")
                    resultString = repr;
            }
            const status = tx?.metadata?.status;
            const success = status === "success";
            matches.push({
                txId: tx
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
