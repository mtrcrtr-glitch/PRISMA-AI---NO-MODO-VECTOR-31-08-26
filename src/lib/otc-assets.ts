/**
 * OTC asset list — IDs confirmed by price-probing the OPTGO broker.
 * Each asset has: id, symbol, label, category
 */

export interface OtcAsset {
  id: number;
  symbol: string;
  label: string;
  category: "forex" | "stock" | "crypto";
}

export const OTC_ASSETS: OtcAsset[] = [
  // ── Forex OTC ───────────────────────────────────────
  { id: 76, symbol: "EURUSD-OTC", label: "EUR/USD OTC", category: "forex" },
  { id: 77, symbol: "EURGBP-OTC", label: "EUR/GBP OTC", category: "forex" },
  { id: 79, symbol: "EURJPY-OTC", label: "EUR/JPY OTC", category: "forex" },
  { id: 80, symbol: "AUDUSD-OTC", label: "AUD/USD OTC", category: "forex" },
  { id: 81, symbol: "GBPUSD-OTC", label: "GBP/USD OTC", category: "forex" },
  { id: 82, symbol: "AUDJPY-OTC", label: "AUD/JPY OTC", category: "forex" },
  { id: 84, symbol: "GBPJPY-OTC", label: "GBP/JPY OTC", category: "forex" },
  { id: 85, symbol: "USDJPY-OTC", label: "USD/JPY OTC", category: "forex" },
  { id: 86, symbol: "USDCHF-OTC", label: "USD/CHF OTC", category: "forex" },
  { id: 87, symbol: "CADJPY-OTC", label: "CAD/JPY OTC", category: "forex" },
  { id: 100, symbol: "USDCAD-OTC", label: "USD/CAD OTC", category: "forex" },
  { id: 101, symbol: "CHFJPY-OTC", label: "CHF/JPY OTC", category: "forex" },
  { id: 102, symbol: "GBPAUD-OTC", label: "GBP/AUD OTC", category: "forex" },
  { id: 103, symbol: "EURCHF-OTC", label: "EUR/CHF OTC", category: "forex" },
  { id: 104, symbol: "GBPCAD-OTC", label: "GBP/CAD OTC", category: "forex" },
  { id: 105, symbol: "EURCAD-OTC", label: "EUR/CAD OTC", category: "forex" },
  { id: 107, symbol: "NZDUSD-OTC", label: "NZD/USD OTC", category: "forex" },
  // ── Stocks OTC ──────────────────────────────────────
  { id: 1, symbol: "AAPL-OTC", label: "Apple OTC", category: "stock" },
  { id: 3, symbol: "AMZN-OTC", label: "Amazon OTC", category: "stock" },
  { id: 4, symbol: "MSFT-OTC", label: "Microsoft OTC", category: "stock" },
  { id: 5, symbol: "NVDA-OTC", label: "NVIDIA OTC", category: "stock" },
  { id: 6, symbol: "GOOGL-OTC", label: "Google OTC", category: "stock" },
  { id: 7, symbol: "META-OTC", label: "Meta OTC", category: "stock" },
  { id: 8, symbol: "TSLA-OTC", label: "Tesla OTC", category: "stock" },
  { id: 9, symbol: "JPM-OTC", label: "JPMorgan OTC", category: "stock" },
  { id: 10, symbol: "NFLX-OTC", label: "Netflix OTC", category: "stock" },
  { id: 11, symbol: "BA-OTC", label: "Boeing OTC", category: "stock" },
];

export function getAssetById(id: number): OtcAsset | undefined {
  return OTC_ASSETS.find((a) => a.id === id);
}