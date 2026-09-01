/**
 * Technical analysis engine for OTC signals powered by:
 * JOSE TRADER - TAXA DIVIDIDA v3 (Fixo) [TAXA3]
 */

import type { Candle } from "#/lib/broker.server.ts";
import {
  evaluateTaxaDividida,
  type ConfluenceCheck,
  type TaxaDivididaMarker,
} from "#/lib/taxa-dividida.ts";

export interface Analysis {
  direction: "call" | "put";
  strength: number; // 0-100
  confidence: "LOW" | "MED" | "HIGH";
  reasons: string[];
  blocks: string[];
  emaMacro: number; // EMA 100
  emaInter: number; // EMA 50
  ema9: number; // For compatibility
  ema21: number; // For compatibility
  buffer1: number; // SMA(1) - SMA(34)
  buffer2: number; // WMA(Buffer1, 5)
  gatilhoTaxa50: number | null;
  rsi: number;
  bbUpper: number;
  bbLower: number;
  bbMid: number;
  lastPrice: number;
  trend: "up" | "down" | "lateral";
  candleContext: string;
  nextDir: "call" | "put";
  nextProb: number;
  pattern: string;
  analysts: AnalystVerdict[];
  signalReady: boolean; // True when Taxa Dividida confirms entry on current candle
  statusText: string;
  buyOK: boolean;
  sellOK: boolean;
  armedBuy: boolean;
  armedSell: boolean;
  markers: TaxaDivididaMarker[];
  winRateDirect: number;
  winRateGale1: number;
  totalSignals: number;
  winsDirect: number;
  winsGale1: number;
  losses: number;
  aiConfluenceScore: number;
  confluenceChecks: ConfluenceCheck[];
}

export interface AnalystVerdict {
  name: string;
  icon: string;
  direction: "call" | "put" | "hold";
  confidence: number;
  opinion: string;
}

// ─── Auxiliary Indicators ───────────────────────────────────────────────────

function ema(values: number[], period: number): number[] {
  if (values.length < period) return values.map(() => NaN);
  const k = 2 / (period + 1);
  const result: number[] = Array.from({ length: values.length }, () => NaN);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  result[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    result[i] = values[i] * k + (result[i - 1] ?? 0) * (1 - k);
  }
  return result;
}

function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const rs = gains / (losses || 0.0001);
  return 100 - 100 / (1 + rs);
}

function bollingerBands(
  closes: number[],
  period = 20,
  stdMult = 2,
): { upper: number; mid: number; lower: number } {
  if (closes.length < period) {
    const last = closes[closes.length - 1] ?? 0;
    return { upper: last, mid: last, lower: last };
  }
  const slice = closes.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, v) => sum + (v - mid) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  return { upper: mid + stdMult * std, mid, lower: mid - stdMult * std };
}

// ─── Main analysis engine ────────────────────────────────────────────────────

export function analyze(candles: Candle[]): Analysis | null {
  if (candles.length < 35) return null;

  const taxaResult = evaluateTaxaDividida(candles);
  if (!taxaResult) return null;

  const closes = candles.map((c) => c.close);
  const last = candles[candles.length - 1];
  const lastPrice = last.close;

  const ema9arr = ema(closes, 9);
  const ema21arr = ema(closes, 21);
  const e9 = ema9arr[ema9arr.length - 1] ?? lastPrice;
  const e21 = ema21arr[ema21arr.length - 1] ?? lastPrice;

  const rsiVal = rsi(closes, 14);
  const bb = bollingerBands(closes, 20, 2);

  // Trend
  const trend: "up" | "down" | "lateral" =
    lastPrice > taxaResult.emaMacro && lastPrice > taxaResult.emaInter
      ? "up"
      : lastPrice < taxaResult.emaMacro && lastPrice < taxaResult.emaInter
        ? "down"
        : "lateral";

  // Build the individual module verdicts based on Taxa Dividida rules
  const verdicts: AnalystVerdict[] = [
    {
      name: "Padrão Taxa 50%",
      icon: "🎯",
      direction: taxaResult.buyOK
        ? "call"
        : taxaResult.sellOK
          ? "put"
          : taxaResult.armedBuy
            ? "call"
            : taxaResult.armedSell
              ? "put"
              : "hold",
      confidence: taxaResult.buyOK || taxaResult.sellOK ? 100 : taxaResult.armedBuy || taxaResult.armedSell ? 75 : 30,
      opinion: taxaResult.gatilhoTaxa50
        ? `Gatilho vela 4 com teste de 50% em ${taxaResult.gatilhoTaxa50.toFixed(4)}`
        : "Aguardando rompimento e retração na taxa 50%",
    },
    {
      name: "Motor Micro (SMA1 x SMA34)",
      icon: "⚙️",
      direction: taxaResult.buffer1 > taxaResult.buffer2 ? "call" : "put",
      confidence: Math.abs(taxaResult.buffer1 - taxaResult.buffer2) > 0 ? 80 : 50,
      opinion: `Buffer1: ${taxaResult.buffer1.toFixed(5)} · WMA5: ${taxaResult.buffer2.toFixed(5)}`,
    },
    {
      name: "Filtro Macro EMA 100",
      icon: "🌐",
      direction: lastPrice > taxaResult.emaMacro ? "call" : "put",
      confidence: 85,
      opinion: `Preço ${lastPrice > taxaResult.emaMacro ? "acima (Alta)" : "abaixo (Baixa)"} da EMA 100 (${taxaResult.emaMacro.toFixed(4)})`,
    },
    {
      name: "Filtro Inter EMA 50",
      icon: "📈",
      direction: lastPrice > taxaResult.emaInter ? "call" : "put",
      confidence: 80,
      opinion: `Preço ${lastPrice > taxaResult.emaInter ? "acima (Alta)" : "abaixo (Baixa)"} da EMA 50 (${taxaResult.emaInter.toFixed(4)})`,
    },
    {
      name: "Falha de Rejeição (Vela 1)",
      icon: "🛡️",
      direction: taxaResult.direction,
      confidence: taxaResult.armedBuy || taxaResult.armedSell ? 90 : 40,
      opinion: taxaResult.armedBuy
        ? "Falha dos ursos confirmada na vela 1 (engolfo/rejeição de alta)"
        : taxaResult.armedSell
          ? "Falha dos touros confirmada na vela 1 (engolfo/rejeição de baixa)"
          : "Aguardando confirmação de rejeição contrária",
    },
  ];

  const candleContext = taxaResult.statusText;

  return {
    direction: taxaResult.direction,
    strength: taxaResult.strength,
    confidence: taxaResult.confidence,
    reasons: taxaResult.reasons,
    blocks: taxaResult.blocks,
    emaMacro: taxaResult.emaMacro,
    emaInter: taxaResult.emaInter,
    ema9: e9,
    ema21: e21,
    buffer1: taxaResult.buffer1,
    buffer2: taxaResult.buffer2,
    gatilhoTaxa50: taxaResult.gatilhoTaxa50,
    rsi: rsiVal,
    bbUpper: bb.upper,
    bbLower: bb.lower,
    bbMid: bb.mid,
    lastPrice,
    trend,
    candleContext,
    nextDir: taxaResult.direction,
    nextProb: taxaResult.strength > 0 ? taxaResult.strength : 50,
    pattern: taxaResult.statusText,
    analysts: verdicts,
    signalReady: taxaResult.signalReady,
    statusText: taxaResult.statusText,
    buyOK: taxaResult.buyOK,
    sellOK: taxaResult.sellOK,
    armedBuy: taxaResult.armedBuy,
    armedSell: taxaResult.armedSell,
    markers: taxaResult.markers,
    winRateDirect: taxaResult.winRateDirect,
    winRateGale1: taxaResult.winRateGale1,
    totalSignals: taxaResult.totalSignals,
    winsDirect: taxaResult.winsDirect,
    winsGale1: taxaResult.winsGale1,
    losses: taxaResult.losses,
    aiConfluenceScore: taxaResult.aiConfluenceScore,
    confluenceChecks: taxaResult.confluenceChecks,
  };
}

// ─── Soros progression ───────────────────────────────────────────────────────

export function sorosProgression(
  base: number,
  payout: number,
  levels: number,
): { level: number; amount: number; profit: number }[] {
  const payoutRate = payout / 100;
  const result: { level: number; amount: number; profit: number }[] = [];
  let amount = base;
  for (let i = 1; i <= levels; i++) {
    const profit = amount * payoutRate;
    result.push({ level: i, amount: parseFloat(amount.toFixed(2)), profit: parseFloat(profit.toFixed(2)) });
    amount = amount + profit;
  }
  return result;
}
