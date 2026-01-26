// ============================================
// Configuration

import dotenv from "dotenv";
import { CHAINHOOKS_BASE_URL } from "@hirosystems/chainhooks-client";
import { parseIntOrDefault } from "./lib";
import {
  BurnEvent,
  ChainhookProvider,
  MintEvent,
  StacksNetwork,
  Stats,
  TransferEvent,
} from "./types";

dotenv.config();

// ============================================
export const PORT = parseIntOrDefault(process.env.PORT, 3000);
export const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS ?? "ST1G4ZDXED8XM2XJ4Q4GJ7F4PG4EJQ1KKXVPSAX13";
export const CONTRACT_NAME = process.env.CONTRACT_NAME ?? "bitcoin-stamp";
export const CHAINHOOK_NODE_URL =
  process.env.CHAINHOOK_NODE_URL ?? "https://api.testnet.hiro.so";
export const CHAINHOOK_AUTH_TOKEN =
  process.env.CHAINHOOK_AUTH_TOKEN ?? "sukanto";
export const CHAINHOOK_PROVIDER = (process.env.CHAINHOOK_PROVIDER ??
  (process.env.HIRO_API_KEY ? "hiro" : "hiro")) as ChainhookProvider;
export const HIRO_API_KEY =
  process.env.HIRO_API_KEY ?? "7d67ccb881aadca8bf25860fa171e84a";
export const EXTERNAL_URL =
  process.env.EXTERNAL_URL ??
  `https://won-itself-took-classified.trycloudflare.com`;
export const STACKS_NETWORK = (process.env.STACKS_NETWORK ??
  "testnet") as StacksNetwork;

// ============================================
// Faucet configuration
export const FAUCET_ENABLED =
  (process.env.FAUCET_ENABLED ?? "true").toLowerCase() === "true";
export const FAUCET_ALLOW_MAINNET =
  (process.env.FAUCET_ALLOW_MAINNET ?? "false").toLowerCase() === "true";
export const FAUCET_PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY ?? "";
export const FAUCET_ADDRESS = process.env.FAUCET_ADDRESS ?? "";
export const FAUCET_AMOUNT_STX = process.env.FAUCET_AMOUNT_STX ?? "1";
export const FAUCET_COOLDOWN_MINUTES = parseIntOrDefault(
  process.env.FAUCET_COOLDOWN_MINUTES,
  60 * 24
);
export const FAUCET_IP_COOLDOWN_MINUTES = parseIntOrDefault(
  process.env.FAUCET_IP_COOLDOWN_MINUTES,
  FAUCET_COOLDOWN_MINUTES
);

// Hiro Stacks API base URL (useful for read-only data fetch)
export const STACKS_API_BASE_URL =
  process.env.STACKS_API_BASE_URL ??
  (STACKS_NETWORK === "mainnet"
    ? CHAINHOOKS_BASE_URL.mainnet
    : CHAINHOOKS_BASE_URL.testnet);

export const CONTRACT_IDENTIFIER = `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`;

export const stats: Stats = {
  totalMints: 0,
  paidMints: 0,
  freeMints: 0,
  ownerMints: 0,
  totalTransfers: 0,
  totalBurns: 0,
  activeUsers: new Set(),
};

export const mintEvents: MintEvent[] = [];
export const transferEvents: TransferEvent[] = [];
export const burnEvents: BurnEvent[] = [];
