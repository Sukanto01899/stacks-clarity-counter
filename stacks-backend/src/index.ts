import express from "express";
import cors from "cors";
import type { Predicate } from "@hirosystems/chainhook-client";
import {
  ChainhooksClient,
  CHAINHOOKS_BASE_URL,
  type Chainhook,
  type ChainhookDefinition,
} from "@hirosystems/chainhooks-client";
import { StacksNetwork } from "./types";
import { getErrorMessage } from "./lib";
import {
  CHAINHOOK_AUTH_TOKEN,
  CHAINHOOK_NODE_URL,
  CHAINHOOK_PROVIDER,
  CONTRACT_IDENTIFIER,
  EXTERNAL_URL,
  HIRO_API_KEY,
  PORT,
  STACKS_NETWORK,
} from "./config";
import webhookRoute from "./routes/webhook";
import dataRoute from "./routes/data-route";

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForChainhookNode(chainhookNodeUrl: string): Promise<void> {
  const deadlineMs = Date.now() + 30_000;
  while (Date.now() < deadlineMs) {
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

  throw new Error(
    `Timed out waiting for Chainhook node at ${chainhookNodeUrl} (check CHAINHOOK_NODE_URL and that the service is running)`,
  );
}

type PredicateActiveStatus = boolean | "missing";

async function getPredicateStatus(
  chainhookNodeUrl: string,
  uuid: string,
): Promise<PredicateActiveStatus> {
  try {
    const response = await fetch(
      `${chainhookNodeUrl}/v1/chainhooks/${encodeURIComponent(uuid)}`,
      { method: "GET", headers: { accept: "application/json" } },
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
  uuid: string,
): Promise<void> {
  await fetch(
    `${chainhookNodeUrl}/v1/chainhooks/${chain}/${encodeURIComponent(uuid)}`,
    { method: "DELETE", headers: { "content-type": "application/json" } },
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
  chainhookNodeUrl: string,
): Promise<void> {
  await waitForChainhookNode(chainhookNodeUrl);

  for (const predicate of predicates) {
    const status = await getPredicateStatus(chainhookNodeUrl, predicate.uuid);
    if (status === true) continue;

    if (status === false) {
      await deletePredicate(
        chainhookNodeUrl,
        predicate.chain as "stacks",
        predicate.uuid,
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
  return network === "mainnet"
    ? CHAINHOOKS_BASE_URL.mainnet
    : CHAINHOOKS_BASE_URL.testnet;
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

if (!CHAINHOOK_AUTH_TOKEN) {
  console.warn(
    "Warning: CHAINHOOK_AUTH_TOKEN is not set. Webhook endpoints will reject requests.",
  );
}

if (CHAINHOOK_PROVIDER === "hiro" && !HIRO_API_KEY) {
  console.warn(
    "Warning: CHAINHOOK_PROVIDER is 'hiro' but HIRO_API_KEY is not set. Chainhook registration will fail.",
  );
}

// ============================================
// Express app setup
// ============================================
const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.use("/webhooks", webhookRoute);
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// ============================================
// API Endpoints
// ============================================
app.use("/api", dataRoute);

// ============================================
// Start server
// ============================================
const chainhookDefinitions: Array<{
  name: string;
  method: string;
  webhookPath: string;
}> = [
  {
    name: "bitcoin-stamp-paid-mint",
    method: "mint",
    webhookPath: "/webhooks/paid-mint",
  },
  {
    name: "bitcoin-stamp-free-mint",
    method: "free-mint",
    webhookPath: "/webhooks/free-mint",
  },
  {
    name: "bitcoin-stamp-owner-mint",
    method: "owner-mint",
    webhookPath: "/webhooks/owner-mint",
  },
  {
    name: "bitcoin-stamp-transfer",
    method: "transfer",
    webhookPath: "/webhooks/transfer",
  },
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
  }),
);

const server = app.listen(PORT, async () => {
  console.log(`API server listening on ${EXTERNAL_URL}`);
  console.log(
    `Config: STACKS_NETWORK=${STACKS_NETWORK} CHAINHOOK_PROVIDER=${CHAINHOOK_PROVIDER} CONTRACT=${CONTRACT_IDENTIFIER}`,
  );

  if (CHAINHOOK_PROVIDER === "hiro") {
    const host = new URL(EXTERNAL_URL).hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      console.warn(
        `Warning: EXTERNAL_URL (${EXTERNAL_URL}) is not publicly reachable; Hiro Chainhooks cannot deliver webhooks to localhost.`,
      );
    }
  }

  try {
    if (CHAINHOOK_PROVIDER === "hiro") {
      console.log(
        `Registering chainhooks via Hiro API (${STACKS_NETWORK}) at ${chainhooksBaseUrlForNetwork(
          STACKS_NETWORK,
        )}...`,
      );

      const defs = chainhookDefinitions.map((def) =>
        buildChainhookDefinition({
          name: def.name,
          method: def.method,
          network: STACKS_NETWORK,
          contractIdentifier: CONTRACT_IDENTIFIER,
          webhookPath: def.webhookPath,
          authToken: CHAINHOOK_AUTH_TOKEN,
        }),
      );

      const registered = await registerChainhooksViaHiro({
        apiKey: HIRO_API_KEY,
        network: STACKS_NETWORK,
        definitions: defs,
      });

      console.log(
        `Chainhooks ready: ${registered
          .map((c) => `${c.definition.name} (${c.uuid})`)
          .join(", ")}`,
      );
    } else {
      if (
        /https?:\/\/api\.(testnet|mainnet)\.hiro\.so\/?$/i.test(
          CHAINHOOK_NODE_URL,
        )
      ) {
        throw new Error(
          [
            `CHAINHOOK_PROVIDER is set to 'local' but CHAINHOOK_NODE_URL is a Hiro Stacks API URL (${CHAINHOOK_NODE_URL}).`,
            `For Hiro-hosted chainhooks, set CHAINHOOK_PROVIDER=hiro and provide HIRO_API_KEY.`,
            `For a local Chainhook node, set CHAINHOOK_NODE_URL=http://localhost:20456 (or your node URL).`,
          ].join(" "),
        );
      }

      console.log(
        `Registering predicates against local chainhook node ${CHAINHOOK_NODE_URL} (${STACKS_NETWORK})...`,
      );
      await registerPredicates(predicates, CHAINHOOK_NODE_URL);
      console.log("Predicates registered.");
    }
  } catch (error: unknown) {
    console.error(
      "Failed to register chainhooks:",
      getErrorMessage(error) ?? error,
    );
  }
});

process.on("SIGINT", () => {
  console.log("Shutting down...");
  server.close(() => process.exit(0));
});
