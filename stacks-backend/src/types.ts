export type StacksNetwork = "testnet" | "mainnet";
export type MintType = "paid" | "free" | "owner";
export type ChainhookProvider = "local" | "hiro";

export interface MintEvent {
  tokenId: string;
  minter: string;
  name: string;
  uri: string;
  mintType: MintType;
  txId: string;
  blockHeight: number;
  timestamp: number;
}
export interface TransferEvent {
  tokenId: string;
  from: string;
  to: string;
  txId: string;
  blockHeight: number;
  timestamp: number;
}
export interface BurnEvent {
  tokenId: string;
  owner: string;
  txId: string;
  blockHeight: number;
  timestamp: number;
}
export interface Stats {
  totalMints: number;
  paidMints: number;
  freeMints: number;
  ownerMints: number;
  totalTransfers: number;
  totalBurns: number;
  activeUsers: Set<string>;
}

export type ContractCallMatch = {
  txId: string;
  blockHeight: number;
  timestamp: number;
  sender: string;
  method: string;
  args: string[];
  result: string;
  success: boolean;
};
