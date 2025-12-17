import express, {
  type Request,
  type Response,
  type RequestHandler,
} from "express";
import cors from "cors";
import dotenv from "dotenv";
import { randomUUID } from "crypto";
import type { Predicate, StacksPayload } from "@hirosystems/chainhook-client";
import {
  ChainhooksClient,
  CHAINHOOKS_BASE_URL,
  type Chainhook,
  type ChainhookDefinition,
  type ChainhookEvent,
} from "@hirosystems/chainhooks-client";

dotenv.config();

type StacksNetwork = "testnet" | "mainnet";
type MintType = "paid" | "free" | "owner";
type ChainhookProvider = "local" | "hiro";

interface MintEvent {
  tokenId: string;
  minter: string;
  name: string;
  uri: string;
  mintType: MintType;
  txId: string;
  blockHeight: number;
  timestamp: number;
}

interface TransferEvent {
  tokenId: string;
  from: string;
  to: string;
  txId: string;
  blockHeight: number;
  timestamp: number;
}

interface BurnEvent {
  tokenId: string;
  owner: string;
  txId: string;
  blockHeight: number;
  timestamp: number;
}

interface Stats {
  totalMints: number;
  paidMints: number;
  freeMints: number;
  ownerMints: number;
  totalTransfers: number;
  totalBurns: number;
  activeUsers: Set<string>;
}

function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string") return maybeMessage;
  }
  return undefined;
}

function parseIntOrDefault(
  value: string | undefined,
  fallback: number
): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function isStacksPayload(payload: unknown): payload is StacksPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "apply" in payload &&
    Array.isArray((payload as { apply?: unknown }).apply)
  );
}

function isChainhookEvent(payload: unknown): payload is ChainhookEvent {
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

type ContractCallMatch = {
  txId: string;
  blockHeight: number;
  timestamp: number;
  sender: string;
  method: string;
  args: string[];
  result: string;
  success: boolean;
};

function extractContractCallsFromPayload(
  payload: StacksPayload,
  contractIdentifier: string
): ContractCallMatch[] {
  const matches: ContractCallMatch[] = [];

  for (const block of payload.apply) {
    const blockHeight = block.block_identifier.index;
    const blockTimestamp = block.timestamp;

    for (const tx of block.transactions) {
      if (tx.metadata.kind.type !== "ContractCall") continue;
      if (tx.metadata.kind.data.contract_identifier !== contractIdentifier)
        continue;

      matches.push({
        txId: tx.transaction_identifier.hash,
        blockHeight,
        timestamp: blockTimestamp,
        sender: tx.metadata.sender,
        method: tx.metadata.kind.data.method,
        args: tx.metadata.kind.data.args,
        result: tx.metadata.result,
        success: tx.metadata.success,
      });
    }
  }

  return matches;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForChainhookNode(chainhookNodeUrl: string): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const response = await fetch(`${chainhookNodeUrl}/ping`, {
        method: "GET",
      });
      if (response.ok) return;
    } catch {
      // ignore
    }
    await sleep(1000);
  }
}

type PredicateActiveStatus = boolean | "missing";

async function getPredicateStatus(
  chainhookNodeUrl: string,
  uuid: string
): Promise<PredicateActiveStatus> {
  try {
    const response = await fetch(
      `${chainhookNodeUrl}/v1/chainhooks/${encodeURIComponent(uuid)}`,
      { method: "GET", headers: { accept: "application/json" } }
    );

    if (response.status === 404) return "missing";
    if (!response.ok) return false;

    const json = (await response.json()) as unknown;
    if (
      typeof json === "object" &&
      json !== null &&
      "result" in json &&
      typeof (json as { result?: unknown }).result === "object" &&
      (json as { result: { enabled?: unknown } }).result !== null
    ) {
      const result = (json as { result: { enabled?: unknown } }).result;
      return result.enabled === true;
    }

    return false;
  } catch {
    return false;
  }
}

async function deletePredicate(
  chainhookNodeUrl: string,
  chain: "stacks" | "bitcoin",
  uuid: string
): Promise<void> {
  await fetch(
    `${chainhookNodeUrl}/v1/chainhooks/${chain}/${encodeURIComponent(uuid)}`,
    { method: "DELETE", headers: { "content-type": "application/json" } }
  );
}

function buildContractCallPredicate(options: {
  uuid: string;
  name: string;
  contractIdentifier: string;
  method: string;
  network: StacksNetwork;
  externalUrl: string;
  authToken: string;
  webhookPath: string;
}): Predicate {
  const networkConfig = {
    if_this: {
      scope: "contract_call",
      contract_identifier: options.contractIdentifier,
      method: options.method,
    },
    then_that: {
      http_post: {
        url: `${options.externalUrl}${options.webhookPath}`,
        authorization_header: `Bearer ${options.authToken}`,
      },
    },
    decode_clarity_values: true,
    include_contract_abi: false,
  };

  const networks =
    options.network === "mainnet"
      ? { mainnet: networkConfig }
      : { testnet: networkConfig };

  return {
    uuid: options.uuid,
    name: options.name,
    version: 1,
    chain: "stacks",
    networks,
  } as Predicate;
}

async function registerPredicates(
  predicates: Predicate[],
  chainhookNodeUrl: string
): Promise<void> {
  await waitForChainhookNode(chainhookNodeUrl);

  for (const predicate of predicates) {
    const status = await getPredicateStatus(chainhookNodeUrl, predicate.uuid);
    if (status === true) continue;

    if (status === false) {
      await deletePredicate(
        chainhookNodeUrl,
        predicate.chain as "stacks",
        predicate.uuid
      );
    }

    await fetch(`${chainhookNodeUrl}/v1/chainhooks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(predicate),
    });
  }
}

function buildWebhookUrl(webhookPath: string, authToken: string): string {
  const url = new URL(`${EXTERNAL_URL}${webhookPath}`);
  if (authToken) url.searchParams.set("token", authToken);
  return url.toString();
}

function chainhooksBaseUrlForNetwork(network: StacksNetwork): string {
  if (process.env.CHAINHOOKS_BASE_URL) return process.env.CHAINHOOKS_BASE_URL;
  return network === "mainnet" ? CHAINHOOKS_BASE_URL.mainnet : CHAINHOOKS_BASE_URL.testnet;
}

function buildChainhookDefinition(options: {
  name: string;
  method: string;
  network: StacksNetwork;
  contractIdentifier: string;
  webhookPath: string;
  authToken: string;
}): ChainhookDefinition {
  return {
    version: "1",
    name: options.name,
    chain: "stacks",
    network: options.network,
    filters: {
      events: [
        {
          type: "contract_call",
          contract_identifier: options.contractIdentifier,
          function_name: options.method,
        },
      ],
    },
    action: {
      type: "http_post",
      url: buildWebhookUrl(options.webhookPath, options.authToken),
    },
    options: {
      decode_clarity_values: true,
      enable_on_registration: true,
    },
  };
}

async function registerChainhooksViaHiro(options: {
  apiKey: string;
  network: StacksNetwork;
  definitions: ChainhookDefinition[];
}): Promise<Chainhook[]> {
  const client = new ChainhooksClient({
    baseUrl: chainhooksBaseUrlForNetwork(options.network),
    apiKey: options.apiKey,
  });

  const maxPageSize = 60;
  const byName = new Map<string, Chainhook>();

  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await client.getChainhooks({ limit: maxPageSize, offset });
    for (const hook of page.results) byName.set(hook.definition.name, hook);

    offset += page.results.length;
    if (offset >= page.total) break;
    if (page.results.length === 0) break;
  }

  const results: Chainhook[] = [];
  for (const def of options.definitions) {
    const current = byName.get(def.name);
    if (!current) {
      const created = await client.registerChainhook(def);
      results.push(created);
      continue;
    }

    const updated = await client.updateChainhook(current.uuid, def);
    await client.enableChainhook(current.uuid, true);
    results.push(updated);
  }

  return results;
}

// ============================================
// Configuration
// ============================================
const PORT = parseIntOrDefault(process.env.PORT, 3000);
const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS ?? "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
const CONTRACT_NAME = process.env.CONTRACT_NAME ?? "bitcoin-stamp-nft";
const CHAINHOOK_NODE_URL =
  process.env.CHAINHOOK_NODE_URL ?? "http://localhost:20456";
const CHAINHOOK_AUTH_TOKEN = process.env.CHAINHOOK_AUTH_TOKEN ?? "";
const CHAINHOOK_PROVIDER = (process.env.CHAINHOOK_PROVIDER ??
  (process.env.HIRO_API_KEY ? "hiro" : "local")) as ChainhookProvider;
const HIRO_API_KEY = process.env.HIRO_API_KEY ?? "";
const EXTERNAL_URL = process.env.EXTERNAL_URL ?? `http://localhost:${PORT}`;
const STACKS_NETWORK = (process.env.STACKS_NETWORK ??
  "testnet") as StacksNetwork;

const CONTRACT_IDENTIFIER = `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`;

if (!CHAINHOOK_AUTH_TOKEN) {
  console.warn(
    "Warning: CHAINHOOK_AUTH_TOKEN is not set. Webhook endpoints will reject requests."
  );
}

if (CHAINHOOK_PROVIDER === "hiro" && !HIRO_API_KEY) {
  console.warn(
    "Warning: CHAINHOOK_PROVIDER is 'hiro' but HIRO_API_KEY is not set. Chainhook registration will fail."
  );
}

// ============================================
// Express app setup
// ============================================
const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// In-memory storage (replace with a database in production)
const mintEvents: MintEvent[] = [];
const transferEvents: TransferEvent[] = [];
const burnEvents: BurnEvent[] = [];
const stats: Stats = {
  totalMints: 0,
  paidMints: 0,
  freeMints: 0,
  ownerMints: 0,
  totalTransfers: 0,
  totalBurns: 0,
  activeUsers: new Set(),
};

// Middleware to verify Chainhook auth
const verifyAuth: RequestHandler = (req, res, next) => {
  if (!CHAINHOOK_AUTH_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const authHeader = req.headers.authorization;
  const expectedHeader = `Bearer ${CHAINHOOK_AUTH_TOKEN}`;
  const tokenQuery = req.query.token;

  if (authHeader === expectedHeader) {
    next();
    return;
  }

  if (typeof tokenQuery === "string" && tokenQuery === CHAINHOOK_AUTH_TOKEN) {
    next();
    return;
  }

  if (Array.isArray(tokenQuery) && tokenQuery[0] === CHAINHOOK_AUTH_TOKEN) {
    next();
    return;
  }

  {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
};

function recordMint(mint: MintEvent) {
  mintEvents.push(mint);
  stats.totalMints += 1;
  stats.activeUsers.add(mint.minter);
  if (mint.mintType === "paid") stats.paidMints += 1;
  if (mint.mintType === "free") stats.freeMints += 1;
  if (mint.mintType === "owner") stats.ownerMints += 1;
}

function recordTransfer(transfer: TransferEvent) {
  transferEvents.push(transfer);
  stats.totalTransfers += 1;
  stats.activeUsers.add(transfer.from);
  stats.activeUsers.add(transfer.to);
}

function recordBurn(burn: BurnEvent) {
  burnEvents.push(burn);
  stats.totalBurns += 1;
  stats.activeUsers.add(burn.owner);
}

function buildWebhookHandler(
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

app.post(
  "/webhooks/paid-mint",
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

app.post(
  "/webhooks/free-mint",
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

app.post(
  "/webhooks/owner-mint",
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

app.post(
  "/webhooks/transfer",
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

app.post(
  "/webhooks/burn",
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

// ============================================
// API Endpoints
// ============================================
app.get("/api/stats", (_req: Request, res: Response) => {
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

app.get("/api/mints", (req: Request, res: Response) => {
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

app.get("/api/transfers", (req: Request, res: Response) => {
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

app.get("/api/activity/recent", (req: Request, res: Response) => {
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

app.get("/api/user/:address", (req: Request, res: Response) => {
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

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: Date.now(),
  });
});

// ============================================
// Start server
// ============================================
const chainhookDefinitions: Array<{
  name: string;
  method: string;
  webhookPath: string;
}> = [
  { name: "bitcoin-stamp-paid-mint", method: "mint", webhookPath: "/webhooks/paid-mint" },
  { name: "bitcoin-stamp-free-mint", method: "free-mint", webhookPath: "/webhooks/free-mint" },
  { name: "bitcoin-stamp-owner-mint", method: "owner-mint", webhookPath: "/webhooks/owner-mint" },
  { name: "bitcoin-stamp-transfer", method: "transfer", webhookPath: "/webhooks/transfer" },
  { name: "bitcoin-stamp-burn", method: "burn", webhookPath: "/webhooks/burn" },
];

const predicates: Predicate[] = chainhookDefinitions.map((def) =>
  buildContractCallPredicate({
    uuid: def.name,
    name: def.name,
    contractIdentifier: CONTRACT_IDENTIFIER,
    method: def.method,
    network: STACKS_NETWORK,
    externalUrl: EXTERNAL_URL,
    authToken: CHAINHOOK_AUTH_TOKEN,
    webhookPath: def.webhookPath,
  })
);

const server = app.listen(PORT, async () => {
  console.log(`API server listening on ${EXTERNAL_URL}`);

  try {
    if (CHAINHOOK_PROVIDER === "hiro") {
      console.log(
        `Registering chainhooks via Hiro API (${STACKS_NETWORK}) at ${chainhooksBaseUrlForNetwork(
          STACKS_NETWORK
        )}...`
      );

      const defs = chainhookDefinitions.map((def) =>
        buildChainhookDefinition({
          name: def.name,
          method: def.method,
          network: STACKS_NETWORK,
          contractIdentifier: CONTRACT_IDENTIFIER,
          webhookPath: def.webhookPath,
          authToken: CHAINHOOK_AUTH_TOKEN,
        })
      );

      const registered = await registerChainhooksViaHiro({
        apiKey: HIRO_API_KEY,
        network: STACKS_NETWORK,
        definitions: defs,
      });

      console.log(
        `Chainhooks ready: ${registered
          .map((c) => `${c.definition.name} (${c.uuid})`)
          .join(", ")}`
      );
    } else {
      console.log(
        `Registering predicates against local chainhook node ${CHAINHOOK_NODE_URL} (${STACKS_NETWORK})...`
      );
      await registerPredicates(predicates, CHAINHOOK_NODE_URL);
      console.log("Predicates registered.");
    }
  } catch (error: unknown) {
    console.error(
      "Failed to register chainhooks:",
      getErrorMessage(error) ?? error
    );
  }
});

process.on("SIGINT", () => {
  console.log("Shutting down...");
  server.close(() => process.exit(0));
});
