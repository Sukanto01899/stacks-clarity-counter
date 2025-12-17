"use strict";
// ============================================
// Configuration
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.burnEvents = exports.transferEvents = exports.mintEvents = exports.stats = exports.CONTRACT_IDENTIFIER = exports.STACKS_API_BASE_URL = exports.STACKS_NETWORK = exports.EXTERNAL_URL = exports.HIRO_API_KEY = exports.CHAINHOOK_PROVIDER = exports.CHAINHOOK_AUTH_TOKEN = exports.CHAINHOOK_NODE_URL = exports.CONTRACT_NAME = exports.CONTRACT_ADDRESS = exports.PORT = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const chainhooks_client_1 = require("@hirosystems/chainhooks-client");
const lib_1 = require("./lib");
dotenv_1.default.config();
// ============================================
exports.PORT = (0, lib_1.parseIntOrDefault)(process.env.PORT, 3000);
exports.CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS ?? "ST1G4ZDXED8XM2XJ4Q4GJ7F4PG4EJQ1KKXVPSAX13";
exports.CONTRACT_NAME = process.env.CONTRACT_NAME ?? "bitcoin-stamp";
exports.CHAINHOOK_NODE_URL = process.env.CHAINHOOK_NODE_URL ?? "https://api.testnet.hiro.so";
exports.CHAINHOOK_AUTH_TOKEN = process.env.CHAINHOOK_AUTH_TOKEN ?? "sukanto";
exports.CHAINHOOK_PROVIDER = (process.env.CHAINHOOK_PROVIDER ??
    (process.env.HIRO_API_KEY ? "hiro" : "hiro"));
exports.HIRO_API_KEY = process.env.HIRO_API_KEY ?? "7d67ccb881aadca8bf25860fa171e84a";
exports.EXTERNAL_URL = process.env.EXTERNAL_URL ??
    `https://won-itself-took-classified.trycloudflare.com`;
exports.STACKS_NETWORK = (process.env.STACKS_NETWORK ??
    "testnet");
// Hiro Stacks API base URL (useful for read-only data fetch)
exports.STACKS_API_BASE_URL = process.env.STACKS_API_BASE_URL ??
    (exports.STACKS_NETWORK === "mainnet"
        ? chainhooks_client_1.CHAINHOOKS_BASE_URL.mainnet
        : chainhooks_client_1.CHAINHOOKS_BASE_URL.testnet);
exports.CONTRACT_IDENTIFIER = `${exports.CONTRACT_ADDRESS}.${exports.CONTRACT_NAME}`;
exports.stats = {
    totalMints: 0,
    paidMints: 0,
    freeMints: 0,
    ownerMints: 0,
    totalTransfers: 0,
    totalBurns: 0,
    activeUsers: new Set(),
};
exports.mintEvents = [];
exports.transferEvents = [];
exports.burnEvents = [];
