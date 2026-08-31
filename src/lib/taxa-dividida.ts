/**
 * Strategy: JOSE TRADER - TAXA DIVIDIDA v3 (Fixo) [TAXA3]
 *
 * Micro:
 * - SMA Fast: 1 (Close)
 * - SMA Slow: 34
 * - Buffer1: SMA(1) - SMA(34)
 * - Buffer2: WMA(Buffer1, 5)
 * - Micro Cross: Buffer1 crosses Buffer2
 *
 * Trend Filters:
 * - Macro: EMA 100 (Close > EMA 100 for CALL, Close < EMA 100 for PUT)
 * - Intermediate: EMA 50 (Close > EMA 50 for CALL, Close < EMA 50 for PUT)
 *
 * Taxa Dividida (5-candle pattern):
 * - Candle 4: Gatilho forte (Rompimento / Corpo > 50% da amplitude)
 * - Candle 3 ou 2: Retração (Devolução testando 50% do corpo do gatilho)
 * - Candle 1: Falha contrária (Rejeição)
 * - Candle 0: Entrada na mesma vela do sinal (:00)
 */

import type { Candle } from "#/lib/broker.server.ts";

export interface TaxaDivididaResult {
  direction: "call" | "put";
  buyOK: boolean;
  sellOK: boolean;
  armedBuy: boolean;
  armedSell: boolean;
  signalReady: boolean;
  strength: number; // 0 - 100
  confidence: "LOW" | "MED" | "HIGH";
  statusText: string;
  reasons: string[];
  blocks: string[];
  emaMacro: number; // EMA 100
  emaInter: number; // EMA 50
  buffer1: number; // SMA(1) - SMA(34)
  buffer2: number; // WMA(Buffer1, 5)
  gatilhoTaxa50: number | null;
  lastPrice: number;
  // History of signals for plotting directly on chart candles
  markers: TaxaDivididaMarker[];
}

export interface TaxaDivididaMarker {
  time: number;
  type: "buy" | "sell" | "armed_buy" | "armed_sell";
  price: number;
  label: string;
}

// ─── Mathematical Indicators ─────────────────────────────────────────────────

export function calculateEMA(values: number[], period: number): number[] {
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

export function calculateSMA(values: number[], period: number): number[] {
  const result: number[] = Array.from({ length: values.length }, () => NaN);
  if (values.length < period) return result;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  result[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period];
    result[i] = sum / period;
  }
  return result;
}

export function calculateWMA(values: number[], period: number): number[] {
  const result: number[] = Array.from({ length: values.length }, () => NaN);
  if (values.length < period) return result;
  const weightSum = (period * (period + 1)) / 2; // 15 for period 5
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    let hasNaN = false;
    for (let j = 0; j < period; j++) {
      const val = values[i - (period - 1 - j)];
      if (isNaN(val)) {
        hasNaN = true;
        break;
      }
      sum += val * (j + 1);
    }
    result[i] = hasNaN ? NaN : sum / weightSum;
  }
  return result;
}

// ─── Strategy Evaluation ─────────────────────────────────────────────────────

export function evaluateTaxaDividida(
  candles: Candle[],
  options: {
    useMacro?: boolean;
    useInter?: boolean;
    maFast?: number;
    maSlow?: number;
    signalPeriod?: number;
  } = {},
): TaxaDivididaResult | null {
  if (candles.length < 105) {
    // If we have fewer candles (e.g. 50-100), we can still evaluate with available data
    if (candles.length < 35) return null;
  }

  const useMacro = options.useMacro ?? true;
  const useInter = options.useInter ?? true;
  const maFast = options.maFast ?? 1;
  const maSlow = options.maSlow ?? 34;
  const signalPeriod = options.signalPeriod ?? 5;

  const closes = candles.map((c) => c.close);
  const n = candles.length;
  const lastPrice = closes[n - 1] ?? 0;

  // Indicators calculations across all candles
  const emaMacroArr = calculateEMA(closes, 100);
  const emaInterArr = calculateEMA(closes, 50);
  const smaFastArr = calculateSMA(closes, maFast);
  const smaSlowArr = calculateSMA(closes, maSlow);

  const buffer1Arr: number[] = [];
  for (let i = 0; i < n; i++) {
    const fast = smaFastArr[i] ?? closes[i];
    const slow = smaSlowArr[i] ?? closes[i];
    buffer1Arr.push(fast - slow);
  }

  const buffer2Arr = calculateWMA(buffer1Arr, signalPeriod);

  // Markers history for charting
  const markers: TaxaDivididaMarker[] = [];

  // Evaluate across candles to generate marker history (from index 35 upwards)
  for (let i = 35; i < n; i++) {
    if (i < 4) continue;
    const c1 = candles[i];
    const c2 = candles[i - 1];
    const c3 = candles[i - 2];
    const c4 = candles[i - 3];

    // Bull pattern
    const gatilho_bull =
      c4.close > c4.open && c4.close - c4.open > (c4.high - c4.low) * 0.5;
    const taxa_50_bull = (c4.close + c4.open) / 2;
    const devolveu_bull = c3.low <= taxa_50_bull || c2.low <= taxa_50_bull;
    const falha_venda = c1.close > c1.open && c1.close > c2.close;
    const armedBuy_i = gatilho_bull && devolveu_bull && falha_venda;

    // Bear pattern
    const gatilho_bear =
      c4.close < c4.open && c4.open - c4.close > (c4.high - c4.low) * 0.5;
    const taxa_50_bear = (c4.close + c4.open) / 2;
    const devolveu_bear = c3.high >= taxa_50_bear || c2.high >= taxa_50_bear;
    const falha_compra = c1.close < c1.open && c1.close < c2.close;
    const armedSell_i = gatilho_bear && devolveu_bear && falha_compra;

    // Trend filters
    const emaM = isNaN(emaMacroArr[i]) ? c1.close : emaMacroArr[i];
    const emaI = isNaN(emaInterArr[i]) ? c1.close : emaInterArr[i];

    const macroOkBuy_i = useMacro ? c1.close > emaM : true;
    const macroOkSell_i = useMacro ? c1.close < emaM : true;
    const interOkBuy_i = useInter ? c1.close > emaI : true;
    const interOkSell_i = useInter ? c1.close < emaI : true;

    // Micro cross
    const b1_now = buffer1Arr[i];
    const b1_prev = buffer1Arr[i - 1];
    const b2_now = buffer2Arr[i];
    const b2_prev = buffer2Arr[i - 1];

    const microBuy_i =
      !isNaN(b2_now) && !isNaN(b2_prev) && b1_now > b2_now && b1_prev < b2_prev;
    const microSell_i =
      !isNaN(b2_now) && !isNaN(b2_prev) && b1_now < b2_now && b1_prev > b2_prev;

    const buyOK_i = armedBuy_i && macroOkBuy_i && interOkBuy_i && microBuy_i;
    const sellOK_i = armedSell_i && macroOkSell_i && interOkSell_i && microSell_i;

    if (buyOK_i) {
      markers.push({
        time: c1.time,
        type: "buy",
        price: c1.low,
        label: "COMPRAR (TAXA)",
      });
    } else if (sellOK_i) {
      markers.push({
        time: c1.time,
        type: "sell",
        price: c1.high,
        label: "VENDER (TAXA)",
      });
    } else if (armedBuy_i) {
      markers.push({
        time: c1.time,
        type: "armed_buy",
        price: c1.low,
        label: "Setup Compra Armado",
      });
    } else if (armedSell_i) {
      markers.push({
        time: c1.time,
        type: "armed_sell",
        price: c1.high,
        label: "Setup Venda Armado",
      });
    }
  }

  // Current state at the latest candle (candle 1 = candles[n - 1])
  const idx = n - 1;
  const c1 = candles[idx];
  const c2 = candles[idx - 1];
  const c3 = candles[idx - 2];
  const c4 = candles[idx - 3];

  // 1. Gatilho Bull (Vela 4)
  const gatilho_bull =
    c4.close > c4.open && c4.close - c4.open > (c4.high - c4.low) * 0.5;
  const taxa_50_bull = (c4.close + c4.open) / 2;
  const devolveu_bull = c3.low <= taxa_50_bull || c2.low <= taxa_50_bull;
  const falha_venda = c1.close > c1.open && c1.close > c2.close;
  const armedBuy = gatilho_bull && devolveu_bull && falha_venda;

  // 1. Gatilho Bear (Vela 4)
  const gatilho_bear =
    c4.close < c4.open && c4.open - c4.close > (c4.high - c4.low) * 0.5;
  const taxa_50_bear = (c4.close + c4.open) / 2;
  const devolveu_bear = c3.high >= taxa_50_bear || c2.high >= taxa_50_bear;
  const falha_compra = c1.close < c1.open && c1.close < c2.close;
  const armedSell = gatilho_bear && devolveu_bear && falha_compra;

  const emaM = isNaN(emaMacroArr[idx]) ? c1.close : emaMacroArr[idx];
  const emaI = isNaN(emaInterArr[idx]) ? c1.close : emaInterArr[idx];

  const macroOkBuy = useMacro ? c1.close > emaM : true;
  const macroOkSell = useMacro ? c1.close < emaM : true;
  const interOkBuy = useInter ? c1.close > emaI : true;
  const interOkSell = useInter ? c1.close < emaI : true;

  const b1_now = buffer1Arr[idx];
  const b1_prev = buffer1Arr[idx - 1];
  const b2_now = buffer2Arr[idx];
  const b2_prev = buffer2Arr[idx - 1];

  const microBuy =
    !isNaN(b2_now) && !isNaN(b2_prev) && b1_now > b2_now && b1_prev < b2_prev;
  const microSell =
    !isNaN(b2_now) && !isNaN(b2_prev) && b1_now < b2_now && b1_prev > b2_prev;

  const buyOK = armedBuy && macroOkBuy && interOkBuy && microBuy;
  const sellOK = armedSell && macroOkSell && interOkSell && microSell;

  const reasons: string[] = [];
  const blocks: string[] = [];

  let direction: "call" | "put" = "call";
  let statusText = "MONITORANDO PADRÃO TAXA DIVIDIDA";
  let strength = 0;
  let signalReady = false;
  let gatilhoTaxa50: number | null = null;

  if (buyOK) {
    direction = "call";
    signalReady = true;
    strength = 100;
    statusText = "COMPRAR (TAXA DIVIDIDA v3)";
    gatilhoTaxa50 = taxa_50_bull;
    reasons.push("Gatilho Vela 4 verde confirmado com amplitude > 50%");
    reasons.push(`Taxa 50% testada com sucesso em ${taxa_50_bull.toFixed(4)}`);
    reasons.push("Vela 1 confirmou falha dos ursos (rejeição de baixa)");
    reasons.push("Cruzamento de alta do Motor Micro (SMA1 x SMA34 x WMA5)");
    if (useMacro) reasons.push("Filtro Macro EMA 100 em alta");
    if (useInter) reasons.push("Filtro Intermediário EMA 50 em alta");
  } else if (sellOK) {
    direction = "put";
    signalReady = true;
    strength = 100;
    statusText = "VENDER (TAXA DIVIDIDA v3)";
    gatilhoTaxa50 = taxa_50_bear;
    reasons.push("Gatilho Vela 4 vermelha confirmado com amplitude > 50%");
    reasons.push(`Taxa 50% testada com sucesso em ${taxa_50_bear.toFixed(4)}`);
    reasons.push("Vela 1 confirmou falha dos touros (rejeição de alta)");
    reasons.push("Cruzamento de baixa do Motor Micro (SMA1 x SMA34 x WMA5)");
    if (useMacro) reasons.push("Filtro Macro EMA 100 em baixa");
    if (useInter) reasons.push("Filtro Intermediário EMA 50 em baixa");
  } else if (armedBuy) {
    direction = "call";
    strength = 70;
    statusText = "SETUP COMPRA ARMADO (Aguardando Cruzamento Micro)";
    gatilhoTaxa50 = taxa_50_bull;
    reasons.push("Padrão Taxa Dividida armado (Vela 4 Gatilho + Devolução + Rejeição)");
    if (!microBuy) blocks.push("Aguardando confirmação de cruzamento no Motor Micro");
    if (!macroOkBuy) blocks.push("Bloqueado: Preço abaixo da Macro EMA 100");
    if (!interOkBuy) blocks.push("Bloqueado: Preço abaixo da Intermediária EMA 50");
  } else if (armedSell) {
    direction = "put";
    strength = 70;
    statusText = "SETUP VENDA ARMADO (Aguardando Cruzamento Micro)";
    gatilhoTaxa50 = taxa_50_bear;
    reasons.push("Padrão Taxa Dividida armado (Vela 4 Gatilho + Devolução + Rejeição)");
    if (!microSell) blocks.push("Aguardando confirmação de cruzamento no Motor Micro");
    if (!macroOkSell) blocks.push("Bloqueado: Preço acima da Macro EMA 100");
    if (!interOkSell) blocks.push("Bloqueado: Preço acima da Intermediária EMA 50");
  } else {
    direction = c1.close >= c1.open ? "call" : "put";
    strength = 20;
    statusText = "Aguardando formação do Gatilho Taxa Dividida";
    blocks.push("Nenhum padrão de 5 velas fechado com rompimento e teste de 50%");
  }

  const confidence: "LOW" | "MED" | "HIGH" = signalReady
    ? "HIGH"
    : armedBuy || armedSell
      ? "MED"
      : "LOW";

  return {
    direction,
    buyOK,
    sellOK,
    armedBuy,
    armedSell,
    signalReady,
    strength,
    confidence,
    statusText,
    reasons,
    blocks,
    emaMacro: emaM,
    emaInter: emaI,
    buffer1: isNaN(b1_now) ? 0 : b1_now,
    buffer2: isNaN(b2_now) ? 0 : b2_now,
    gatilhoTaxa50,
    lastPrice,
    markers,
  };
}
