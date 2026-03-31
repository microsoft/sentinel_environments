/**
 * MicroHood Type Definitions
 *
 * Type definitions for the MicroHood environment (stock trading platform).
 * Actual data is stored in .jsonl files in this directory.
 */

export interface MicroHoodStock {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  change: number;
  changePercent: number;
  color: string;
  orgId: string; // Links to entity in entities.json
}

export interface MicroHoodWatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface MicroHoodNews {
  id: string;
  source: string;
  title: string;
  time: string;
}
