/**
 * Technical analysis engine for OTC signals.
 * Uses EMA, MACD, RSI, ATR, Bollinger Bands + candle reading.
 * Returns direction, strength (0-100), and reasons.
 */

import type { Candle } from "#/lib/broker.server.ts";

export interface Analysis {
  direction: "call" | "put";
  strength: number; // 0-100
  confidence: "LOW" | "MED" | "HIGH";
  reasons: string[];
  blocks: string[];
  ema9: number;
  ema21: number;
  rsi: number;
  bbUpper: number;
  bbLower: number;
  bbMid: number;
  lastPrice: number;
  trend: "up" | "down" | "lateral";
  candleContext: string;
  nextDir: "call" | "put"; // probability-based projection for the next candle
  nextProb: number; // 0-100 confidence the next candle follows nextDir
  pattern: string; // detected candle pattern / color sequence
  analysts: AnalystVerdict[]; // each independent analysis + its own verdict
  signalReady: boolean; // true when a MAJORITY of analysts agree on the direction
}

export interface AnalystVerdict {
  name: string;
  icon: string;
  direction: "call" | "put" | "hold"; // "hold" = no conviction, abstains
  confidence: number; // 0-100
  opinion: string;
}

// ─── Indicators ──────────────────────────────────────────────────────────────

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

function atr(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    trs.push(
      Math.max(
        c.high - c.low,
        Math.abs(c.high - prev.close),
        Math.abs(c.low - prev.close),
      ),
    );
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

// ─── Candle reading (WIN/LOSS rules from strategy videos) ────────────────────

function candleBodyRatio(c: Candle): number {
  const range = c.high - c.low;
  if (range === 0) return 1;
  return Math.abs(c.close - c.open) / range;
}

function isDoji(c: Candle): boolean {
  return candleBodyRatio(c) < 0.1;
}

function isSmallBody(c: Candle): boolean {
  return candleBodyRatio(c) < 0.25;
}

function isStrongBody(c: Candle): boolean {
  return candleBodyRatio(c) > 0.6;
}

function upperWick(c: Candle): number {
  return c.high - Math.max(c.open, c.close);
}

function lowerWick(c: Candle): number {
  return Math.min(c.open, c.close) - c.low;
}

// ─── Candle pattern & next-candle probability engine ────────────────────────
// Uses ALL collected candles (the last ~180 closed 1M candles) to find color
// sequences, runs, "torres gêmeas", cycles of 3-5, and a Markov transition
// probability — then projects how the NEXT candle will likely be (color).

function colorSeq(candles: Candle[]): { dir: number; run: number } {
  const last = candles[candles.length - 1];
  const dir = last.close >= last.open ? 1 : -1; // 1 = verde (up), -1 = vermelha (down)
  let run = 0;
  for (let i = candles.length - 1; i >= 0; i--) {
    const d = candles[i].close >= candles[i].open ? 1 : -1;
    if (d === dir) run++;
    else break;
  }
  return { dir, run };
}

// P(next candle has the same color as the previous) — Markov transition.
function markovSameColor(candles: Candle[]): number {
  const seq = candles.map((c) => (c.close >= c.open ? 1 : -1));
  let same = 0;
  let total = 0;
  for (let i = 1; i < seq.length; i++) {
    if (seq[i] === seq[i - 1]) same++;
    total++;
  }
  return total ? same / total : 0.5;
}

// Historical: after a run of `runLen` same-color candles, how often did the
// SAME color continue (vs reverse)? Learned from all past candles.
function historicalContinuation(candles: Candle[], runLen: number): number {
  const seq = candles.map((c) => (c.close >= c.open ? 1 : -1));
  let cont = 0;
  let total = 0;
  for (let i = runLen; i < seq.length - 1; i++) {
    const win = seq.slice(i - runLen + 1, i + 1);
    if (win.every((v) => v === win[0])) {
      total++;
      if (seq[i + 1] === win[0]) cont++;
    }
  }
  return total ? cont / total : 0.5;
}

// Blends pattern probability with the technical vote probability.
function predictNextCandle(candles: Candle[], techDir: "call" | "put", techStrength: number): {
  nextDir: "call" | "put";
  nextProb: number;
  pattern: string;
} {
  const { dir, run } = colorSeq(candles);
  const markov = markovSameColor(candles);
  const histCont = historicalContinuation(candles, Math.min(run, 5));

  // Base continuation probability of the last color, learned from data.
  let contProb = markov * 0.5 + histCont * 0.5;
  contProb = Math.max(0.35, Math.min(0.65, contProb));

  // Long same-color runs mean-revert (the market gets exhausted).
  if (run >= 3) contProb = 1 - contProb;

  // Probability the next candle is GREEN (dir=1).
  let greenProb = dir === 1 ? contProb : 1 - contProb;

  // Fold in the technical analysis vote (strength) as a secondary signal.
  const techGreen = techDir === "call";
  const techProb = (techStrength / 100) * 0.3;
  if (techGreen) greenProb = greenProb * 0.7 + techProb;
  else greenProb = greenProb * 0.7 + (1 - techProb) * 0.3 * 1.0;

  // greenProb can drift slightly out of [0,1] — clamp.
  greenProb = Math.max(0, Math.min(1, greenProb));

  const nextDir: "call" | "put" = greenProb >= 0.5 ? "call" : "put";
  const nextProb = Math.round((nextDir === "call" ? greenProb : 1 - greenProb) * 100);

  // Pattern label
  let pattern = "Mercado misto";
  if (run >= 5) pattern = `Rally de ${run} velas ${dir === 1 ? "verdes" : "vermelhas"}`;
  else if (run === 3) pattern = `Ciclo de 3 ${dir === 1 ? "verdes" : "vermelhas"}`;
  else if (run === 2 && isStrongBody(candles[candles.length - 1])) pattern = "Torres gêmeas";
  else if (run === 2) pattern = `Par ${dir === 1 ? "verde" : "vermelho"} seguido`;

  return { nextDir, nextProb, pattern };
}

// ─── Main analysis ───────────────────────────────────────────────────────────

export function analyze(candles: Candle[]): Analysis | null {
  if (candles.length < 30) return null;

  const closes = candles.map((c) => c.close);
  const last = candles[candles.length - 1];
  const lastPrice = last.close;

  // EMAs
  const ema9arr = ema(closes, 9);
  const ema21arr = ema(closes, 21);
  const e9 = ema9arr[ema9arr.length - 1] ?? lastPrice;
  const e21 = ema21arr[ema21arr.length - 1] ?? lastPrice;

  // MACD
  const macdLine = e9 - e21;
  const signalArr = ema(ema9arr.filter((v) => !isNaN(v)), 9);
  const macdSignal = signalArr[signalArr.length - 1] ?? 0;
  const macdHist = macdLine - macdSignal;

  // RSI
  const rsiVal = rsi(closes, 14);

  // Bollinger
  const bb = bollingerBands(closes, 20, 2);

  // ATR (used for future volatility filtering)
  void atr(candles, 14);

  // Trend (last 10 closes)
  const t10 = closes.slice(-10);
  const upCount = t10.filter((c, i) => i > 0 && c > t10[i - 1]).length;
  const trend: "up" | "down" | "lateral" =
    upCount >= 7 ? "up" : upCount <= 3 ? "down" : "lateral";

  // Structure: higher highs / lower lows
  const highs = candles.slice(-10).map((c) => c.high);
  const lows = candles.slice(-10).map((c) => c.low);
  const hhCount = highs.filter((h, i) => i > 0 && h > highs[i - 1]).length;
  const llCount = lows.filter((l, i) => i > 0 && l < lows[i - 1]).length;

  const reasons: string[] = [];
  const blocks: string[] = [];

  // ── Candle reading blocks (LOSS scenarios) ──
  // Contraction (doji / small body) does NOT block: the robot executes even
  // when the candle is contracting. Only a lack of trend blocks the signal.
  if (trend === "lateral") blocks.push("Mercado lateral — sem tendência definida");

  // Large pavio rejecting direction
  const uw = upperWick(last);
  const lw = lowerWick(last);
  const bodySize = Math.abs(last.close - last.open);

  // Continuation (4+ same color candles) — used for context and analysis
  const last5 = candles.slice(-5);
  const greens5 = last5.filter((c) => c.close > c.open).length;
  const reds5 = last5.filter((c) => c.close < c.open).length;

  const clampConf = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  // ── Independent analyses (analysts). Each one looks at the chart on its own
  //    and returns its own direction + confidence + opinion. The final signal
  //    is the CONSENSUS: it fires when the MAJORITY points to the same way.
  const verdicts: AnalystVerdict[] = [];

  // 1) Nuvem — Momentum (EMA + MACD)
  {
    const d: "call" | "put" = e9 >= e21 ? "call" : "put";
    let conf = 55;
    if ((d === "call") === (macdHist > 0)) conf += 25;
    else conf += 5;
    if (e9 >= e21 && trend !== "lateral") conf += 10;
    verdicts.push({
      name: "Nuvem",
      icon: "☁️",
      direction: d,
      confidence: clampConf(conf),
      opinion: `EMA9 ${e9 >= e21 ? "acima" : "abaixo"} da EMA21 · MACD ${macdHist >= 0 ? "positivo" : "negativo"}`,
    });
  }

  // 2) Linhas EMA — azul (EMA9) × laranja (EMA21) + reversão sem romper
  //    Compra: vela verde fica ACIMA do alinhamento, padrão de reversão
  //    (pavio inferior longo) forma, e a vela se aproxima mas NÃO rompe a linha.
  //    Venda: o inverso, com pavio superior longo.
  {
    const alignmentUp = e9 >= e21; // azul acima da laranja = alta
    const priceAbove = lastPrice >= Math.max(e9, e21); // vela acima das linhas
    const priceBelow = lastPrice <= Math.min(e9, e21); // vela abaixo das linhas
    // Padrão de reversão: pavio longo rejeitando, sem corpo forte romper a linha
    const bullReject = lw > bodySize * 1.5 && last.close >= last.open; // pavio inferior, verde
    const bearReject = uw > bodySize * 1.5 && last.close <= last.open; // pavio superior, vermelha

    let d: "call" | "put" | "hold" = "hold";
    let conf = 50;
    let opinion = "Sem padrão de reversão claro";
    if (priceAbove && alignmentUp && bullReject) {
      d = "call";
      conf = 62 + (isStrongBody(last) ? 18 : 0) + (e9 > e21 ? 8 : 0);
      opinion = "Vela verde acima das linhas · pavio inferior de reversão sem romper → COMPRA";
    } else if (priceBelow && !alignmentUp && bearReject) {
      d = "put";
      conf = 62 + (isStrongBody(last) ? 18 : 0) + (e21 > e9 ? 8 : 0);
      opinion = "Vela vermelha abaixo das linhas · pavio superior de reversão sem romper → VENDA";
    } else if (priceAbove && alignmentUp) {
      d = "call";
      conf = 55;
      opinion = "Preço se mantém acima das linhas em alta (azul > laranja) — sem romper";
    } else if (priceBelow && !alignmentUp) {
      d = "put";
      conf = 55;
      opinion = "Preço se mantém abaixo das linhas em baixa (laranja > azul) — sem romper";
    }
    verdicts.push({ name: "Linhas", icon: "📉", direction: d, confidence: clampConf(conf), opinion });
  }

  // 3) Padrões de Velas — Markov / sequência / torres gêmeas
  {
    const patternPred = predictNextCandle(candles, e9 >= e21 ? "call" : "put", 60);
    verdicts.push({
      name: "Padrões",
      icon: "🔷",
      direction: patternPred.nextProb < 52 ? "hold" : patternPred.nextDir,
      confidence: patternPred.nextProb,
      opinion: patternPred.pattern,
    });
  }

  // 4) Tendência & Estrutura
  {
    let d: "call" | "put" | "hold" = "hold";
    let conf = 50;
    let opinion = "Mercado lateral — aguardar";
    if (trend === "up") {
      d = "call";
      conf = 60 + (hhCount >= 7 ? 20 : 0);
      opinion = "Tendência de alta confirmada";
    } else if (trend === "down") {
      d = "put";
      conf = 60 + (llCount >= 7 ? 20 : 0);
      opinion = "Tendência de baixa confirmada";
    }
    verdicts.push({ name: "Tendência", icon: "📈", direction: d, confidence: clampConf(conf), opinion });
  }

  // 5) Força Touros × Ursos — vela fechada
  {
    const closed = candles[candles.length - 2] ?? last;
    const dirUp = closed.close >= closed.open;
    let conf = 50;
    let d: "call" | "put" | "hold" = dirUp ? "call" : "put";
    if (isStrongBody(closed)) conf = 70;
    else if (isDoji(closed)) {
      conf = 45;
      d = "hold"; // vela sem corpo não tem vencedor
    }
    const opinion = `${dirUp ? "Verde" : "Vermelha"} · corpo ${isStrongBody(closed) ? "forte" : isSmallBody(closed) ? "reduzido" : "normal"}`;
    verdicts.push({
      name: "Touros×Ursos",
      icon: "⚖️",
      direction: d,
      confidence: clampConf(conf),
      opinion,
    });
  }

  // ── Consensus (majority of the analyses that actually voted) ──
  const voters = verdicts.filter((v) => v.direction !== "hold");
  const callCount = voters.filter((v) => v.direction === "call").length;
  const putCount = voters.filter((v) => v.direction === "put").length;
  const direction: "call" | "put" = callCount >= putCount ? "call" : "put";
  const agreeCount = direction === "call" ? callCount : putCount;
  const totalAnalysts = voters.length;
  const strength = totalAnalysts > 0 ? Math.round((agreeCount / totalAnalysts) * 100) : 0;
  const signalReady = totalAnalysts > 0 && agreeCount > totalAnalysts / 2; // MAJORITY decides
  const confidence: "LOW" | "MED" | "HIGH" =
    signalReady ? (strength >= 75 ? "HIGH" : "MED") : "LOW";

  // Opinions of each independent analysis become the reasons
  reasons.length = 0;
  for (const v of verdicts) {
    const arrow =
      v.direction === "call" ? "CALL ▲" : v.direction === "put" ? "PUT ▼" : "SEM VOTO ⏸";
    reasons.push(`${v.icon} ${v.name}: ${v.opinion} → ${arrow}`);
  }

  // Next-candle projection using the consensus direction
  const next = predictNextCandle(candles, direction, strength);

  // Candle context description
  let candleContext = "Mercado em observação";
  if (isDoji(last)) candleContext = "Contração (doji) — sinal mantido";
  else if (isSmallBody(last)) candleContext = "Contração — corpo reduzido";
  else if (isStrongBody(last) && last.close > last.open && trend === "up")
    candleContext = "Impulso de alta — corpo verde forte";
  else if (isStrongBody(last) && last.close < last.open && trend === "down")
    candleContext = "Impulso de baixa — corpo vermelho forte";
  else if (uw > bodySize * 1.5) candleContext = "Rejeição — pavio superior longo";
  else if (lw > bodySize * 1.5) candleContext = "Rejeição — pavio inferior longo";
  else if (greens5 >= 4) candleContext = "Continuação de alta";
  else if (reds5 >= 4) candleContext = "Continuação de baixa";

  return {
    direction,
    strength,
    confidence,
    reasons: reasons.slice(0, 6),
    blocks,
    ema9: e9,
    ema21: e21,
    rsi: rsiVal,
    bbUpper: bb.upper,
    bbLower: bb.lower,
    bbMid: bb.mid,
    lastPrice,
    trend,
    candleContext,
    nextDir: next.nextDir,
    nextProb: next.nextProb,
    pattern: next.pattern,
    analysts: verdicts,
    signalReady,
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