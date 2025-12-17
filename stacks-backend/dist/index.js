"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const chainhooks_client_1 = require("@hirosystems/chainhooks-client");
const lib_1 = require("./lib");
const config_1 = require("./config");
const webhook_1 = __importDefault(require("./routes/webhook"));
const data_route_1 = __importDefault(require("./routes/data-route"));
async function sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}
async function waitForChainhookNode(chainhookNodeUrl) {
    const deadlineMs = Date.now() + 30_000;
    while (Date.now() < deadlineMs) {
        try {
            const response = await fetch(`${chainhookNodeUrl}/ping`, {
                method: "GET",
            });
            if (response.ok)
                return;
        }
        catch {
            // ignore
        }
        await sleep(1000);
    }
    throw new Error(`Timed out waiting for Chainhook node at ${chainhookNodeUrl} (check CHAINHOOK_NODE_URL and that the service is running)`);
}
async function getPredicateStatus(chainhookNodeUrl, uuid) {
    try {
        const response = await fetch(`${chainhookNodeUrl}/v1/chainhooks/${encodeURIComponent(uuid)}`, { method: "GET", headers: { accept: "application/json" } });
        if (response.status === 404)
            return "missing";
        if (!response.ok)
            return false;
        const json = (await response.json());
        if (typeof json === "object" &&
            json !== null &&
            "result" in json &&
            typeof json.result === "object" &&
            json.result !== null) {
            const result = json.result;
            return result.enabled === true;
        }
        return false;
    }
    catch {
        return false;
    }
}
async function deletePredicate(chainhookNodeUrl, chain, uuid) {
    await fetch(`${chainhookNodeUrl}/v1/chainhooks/${chain}/${encodeURIComponent(uuid)}`, { method: "DELETE", headers: { "content-type": "application/json" } });
}
function buildContractCallPredicate(options) {
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
    const networks = options.network === "mainnet"
        ? { mainnet: networkConfig }
        : { testnet: networkConfig };
    return {
        uuid: options.uuid,
        name: options.name,
        version: 1,
        chain: "stacks",
        networks,
    };
}
async function registerPredicates(predicates, chainhookNodeUrl) {
    await waitForChainhookNode(chainhookNodeUrl);
    for (const predicate of predicates) {
        const status = await getPredicateStatus(chainhookNodeUrl, predicate.uuid);
        if (status === true)
            continue;
        if (status === false) {
            await deletePredicate(chainhookNodeUrl, predicate.chain, predicate.uuid);
        }
        await fetch(`${chainhookNodeUrl}/v1/chainhooks`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(predicate),
        });
    }
}
function buildWebhookUrl(webhookPath, authToken) {
    const url = new URL(`${config_1.EXTERNAL_URL}${webhookPath}`);
    if (authToken)
        url.searchParams.set("token", authToken);
    return url.toString();
}
function chainhooksBaseUrlForNetwork(network) {
    if (process.env.CHAINHOOKS_BASE_URL)
        return process.env.CHAINHOOKS_BASE_URL;
    return network === "mainnet"
        ? chainhooks_client_1.CHAINHOOKS_BASE_URL.mainnet
        : chainhooks_client_1.CHAINHOOKS_BASE_URL.testnet;
}
function buildChainhookDefinition(options) {
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
async function registerChainhooksViaHiro(options) {
    const client = new chainhooks_client_1.ChainhooksClient({
        baseUrl: chainhooksBaseUrlForNetwork(options.network),
        apiKey: options.apiKey,
    });
    const maxPageSize = 60;
    const byName = new Map();
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const page = await client.getChainhooks({ limit: maxPageSize, offset });
        for (const hook of page.results)
            byName.set(hook.definition.name, hook);
        offset += page.results.length;
        if (offset >= page.total)
            break;
        if (page.results.length === 0)
            break;
    }
    const results = [];
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
if (!config_1.CHAINHOOK_AUTH_TOKEN) {
    console.warn("Warning: CHAINHOOK_AUTH_TOKEN is not set. Webhook endpoints will reject requests.");
}
if (config_1.CHAINHOOK_PROVIDER === "hiro" && !config_1.HIRO_API_KEY) {
    console.warn("Warning: CHAINHOOK_PROVIDER is 'hiro' but HIRO_API_KEY is not set. Chainhook registration will fail.");
}
// ============================================
// Express app setup
// ============================================
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "5mb" }));
app.use("/webhooks", webhook_1.default);
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
});
// ============================================
// API Endpoints
// ============================================
app.use("/api", data_route_1.default);
// ============================================
// Start server
// ============================================
const chainhookDefinitions = [
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
const predicates = chainhookDefinitions.map((def) => buildContractCallPredicate({
    uuid: def.name,
    name: def.name,
    contractIdentifier: config_1.CONTRACT_IDENTIFIER,
    method: def.method,
    network: config_1.STACKS_NETWORK,
    externalUrl: config_1.EXTERNAL_URL,
    authToken: config_1.CHAINHOOK_AUTH_TOKEN,
    webhookPath: def.webhookPath,
}));
const server = app.listen(config_1.PORT, async () => {
    console.log(`API server listening on ${config_1.EXTERNAL_URL}`);
    console.log(`Config: STACKS_NETWORK=${config_1.STACKS_NETWORK} CHAINHOOK_PROVIDER=${config_1.CHAINHOOK_PROVIDER} CONTRACT=${config_1.CONTRACT_IDENTIFIER}`);
    if (config_1.CHAINHOOK_PROVIDER === "hiro") {
        const host = new URL(config_1.EXTERNAL_URL).hostname;
        if (host === "localhost" || host === "127.0.0.1") {
            console.warn(`Warning: EXTERNAL_URL (${config_1.EXTERNAL_URL}) is not publicly reachable; Hiro Chainhooks cannot deliver webhooks to localhost.`);
        }
    }
    try {
        if (config_1.CHAINHOOK_PROVIDER === "hiro") {
            console.log(`Registering chainhooks via Hiro API (${config_1.STACKS_NETWORK}) at ${chainhooksBaseUrlForNetwork(config_1.STACKS_NETWORK)}...`);
            const defs = chainhookDefinitions.map((def) => buildChainhookDefinition({
                name: def.name,
                method: def.method,
                network: config_1.STACKS_NETWORK,
                contractIdentifier: config_1.CONTRACT_IDENTIFIER,
                webhookPath: def.webhookPath,
                authToken: config_1.CHAINHOOK_AUTH_TOKEN,
            }));
            const registered = await registerChainhooksViaHiro({
                apiKey: config_1.HIRO_API_KEY,
                network: config_1.STACKS_NETWORK,
                definitions: defs,
            });
            console.log(`Chainhooks ready: ${registered
                .map((c) => `${c.definition.name} (${c.uuid})`)
                .join(", ")}`);
        }
        else {
            if (/https?:\/\/api\.(testnet|mainnet)\.hiro\.so\/?$/i.test(config_1.CHAINHOOK_NODE_URL)) {
                throw new Error([
                    `CHAINHOOK_PROVIDER is set to 'local' but CHAINHOOK_NODE_URL is a Hiro Stacks API URL (${config_1.CHAINHOOK_NODE_URL}).`,
                    `For Hiro-hosted chainhooks, set CHAINHOOK_PROVIDER=hiro and provide HIRO_API_KEY.`,
                    `For a local Chainhook node, set CHAINHOOK_NODE_URL=http://localhost:20456 (or your node URL).`,
                ].join(" "));
            }
            console.log(`Registering predicates against local chainhook node ${config_1.CHAINHOOK_NODE_URL} (${config_1.STACKS_NETWORK})...`);
            await registerPredicates(predicates, config_1.CHAINHOOK_NODE_URL);
            console.log("Predicates registered.");
        }
    }
    catch (error) {
        console.error("Failed to register chainhooks:", (0, lib_1.getErrorMessage)(error) ?? error);
    }
});
process.on("SIGINT", () => {
    console.log("Shutting down...");
    server.close(() => process.exit(0));
});
