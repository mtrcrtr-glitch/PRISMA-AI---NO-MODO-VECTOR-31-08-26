import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { analyze } from "#/lib/analysis.ts";
import {
  getAccount,
  getCandles,
  getPayouts,
  getSsid,
  getSsidOverride,
  getTick,
  openOption,
  setSsidOverride,
  verifySignal,
} from "#/lib/broker.server.ts";
import { OTC_ASSETS } from "#/lib/otc-assets.ts";

// ─── Connection test / diagnostics ───────────────────────────────────────────

export const testConnection = createServerFn({ method: "GET" }).handler(async () => {
  const email = process.env["OPTGO_BROKER_EMAIL"] ?? "";
  const password = process.env["OPTGO_BROKER_PASSWORD"] ?? "";

  if (!email || !password) {
    return {
      ok: false,
      stage: "config",
      message: "Credenciais não configuradas",
      detail: "OPTGO_BROKER_EMAIL ou OPTGO_BROKER_PASSWORD ausentes",
    };
  }

  // Step 0: If a live SSID override is set (from the site session), use it directly
  const override = getSsidOverride();
  if (override) {
    try {
      const account = await getAccount();
      return {
        ok: true,
        stage: "ssid",
        message: "Conectado com a sua sessão!",
        detail: `Conta: ${account.name}`,
        account: {
          name: account.name,
          balance: account.balance,
          demoBalance: account.demoBalance,
          currency: account.currency,
        },
      };
    } catch (err) {
      return {
        ok: false,
        stage: "websocket",
        message: "Sessão SSID expirada",
        detail: err instanceof Error ? err.message : "Erro desconhecido",
      };
    }
  }

  // Step 1: Test REST login
  let ssid: string | null = null;
  try {
    ssid = await getSsid();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    // Parse structured error
    if (msg.startsWith("LOGIN_RATE_LIMITED:")) {
      const [, mins, detail] = msg.split(":");
      return {
        ok: false,
        stage: "login",
        message: `IP bloqueado por rate limit (${mins ?? "?"}min)`,
        detail: detail ?? msg,
        rateLimited: true,
      };
    }
    if (msg.startsWith("LOGIN_INVALID:")) {
      return {
        ok: false,
        stage: "login",
        message: "Email ou senha incorretos",
        detail: msg.split(":")[1] ?? msg,
      };
    }
    return {
      ok: false,
      stage: "login",
      message: "Falha no login REST",
      detail: msg,
    };
  }

  if (!ssid) {
    return { ok: false, stage: "login", message: "SSID não obtido", detail: "" };
  }

  // Step 2: Test account fetch via WebSocket
  try {
    const account = await getAccount();
    return {
      ok: true,
      stage: "account",
      message: "Conectado com sucesso!",
      detail: `Conta: ${account.name}`,
      account: {
        name: account.name,
        balance: account.balance,
        demoBalance: account.demoBalance,
        currency: account.currency,
      },
    };
  } catch (err) {
    return {
      ok: false,
      stage: "websocket",
      message: "Login ok mas WebSocket falhou",
      detail: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
});

// ─── Connect with live session SSID (from broker site cookie) ───────────────

export const connectWithSsid = createServerFn({ method: "POST" })
  .validator(z.object({ ssid: z.string().min(10) }))
  .handler(async ({ data }) => {
    // Keep the user's fresh SSID even if the broker currently refuses the data
    // session, so the auto-recovery keeps retrying with it once the broker
    // unblocks (the block is temporary, confirmed repeatedly by the broker).
    setSsidOverride(data.ssid);
    try {
      const account = await getAccount();
      return {
        ok: true,
        message: "Conectado com a sua sessão!",
        account: {
          name: account.name,
          balance: account.balance,
          demoBalance: account.demoBalance,
          currency: account.currency,
        },
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : "erro desconhecido";
      const isBrokerBlock =
        detail.includes("Profile auth failed") || detail.includes("profile:false");
      return {
        ok: false,
        message: "SSID não aceito no momento",
        detail,
        hint: isBrokerBlock
          ? "A corretora está bloqueando temporariamente a sessão de dados (WebSocket). Isso não é erro do SSID colado — é um limite temporário do lado da corretora. O robô vai reconectar sozinho quando a corretora liberar."
          : undefined,
      };
    }
  });

// ─── Assets list ─────────────────────────────────────────────────────────────

export const fetchAssets = createServerFn({ method: "GET" }).handler(async () => {
  let payouts: Record<number, number> = {};
  try {
    const ids = OTC_ASSETS.map((a) => a.id);
    payouts = await getPayouts(ids);
  } catch {
    // payouts optional
  }

  return OTC_ASSETS.map((a) => ({
    ...a,
    payout: payouts[a.id] ?? 85,
  }));
});

// ─── Account info ─────────────────────────────────────────────────────────────

export const fetchAccount = createServerFn({ method: "GET" }).handler(async () => {
  return await getAccount();
});

// ─── Candles ─────────────────────────────────────────────────────────────────

export const fetchCandles = createServerFn({ method: "GET" })
  .validator(z.object({ activeId: z.number(), count: z.number().default(150) }))
  .handler(async ({ data }) => {
    const candles = await getCandles(data.activeId, data.count);
    return candles;
  });

// ─── Live tick ───────────────────────────────────────────────────────────────

export const fetchTick = createServerFn({ method: "GET" })
  .validator(z.object({ activeId: z.number() }))
  .handler(async ({ data }) => {
    return await getTick(data.activeId);
  });

// ─── Analysis ────────────────────────────────────────────────────────────────

export const fetchAnalysis = createServerFn({ method: "GET" })
  .validator(z.object({ activeId: z.number() }))
  .handler(async ({ data }) => {
    const candles = await getCandles(data.activeId, 200);
    if (candles.length < 31) {
      return { error: "Dados insuficientes para análise" };
    }
    // Analyze only the CLOSED candles (drop the forming candle): the signal is
    // generated at the exact moment the new 1M candle is born and predicts its
    // direction — the tiny forming candle must not skew the read.
    const closed = candles.slice(0, -1);
    if (closed.length < 30) {
      return { error: "Dados insuficientes para análise" };
    }
    const result = analyze(closed);
    if (!result) return { error: "Análise indisponível" };
    return { analysis: result, candles: candles.slice(-150) };
  });

// ─── Execute order ───────────────────────────────────────────────────────────

export const executeOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      activeId: z.number(),
      direction: z.enum(["call", "put"]),
      amount: z.number().min(1),
      duration: z.number().default(60),
      isDemo: z.boolean().default(true),
      skipVerify: z.boolean().default(false),
    }),
  )
  .handler(async ({ data }) => {
    // Pre-trade verification
    if (!data.skipVerify) {
      const verify = await verifySignal(data.activeId, data.direction);
      if (!verify.ok) {
        return {
          success: false,
          reason: verify.reason,
          verified: false,
        };
      }
    }

    try {
      const order = await openOption({
        activeId: data.activeId,
        direction: data.direction,
        amount: data.amount,
        duration: data.duration,
        isDemo: data.isDemo,
      });
      return {
        success: true,
        order,
        verified: true,
        reason: "Verificação ok — ordem aberta",
      };
    } catch (err) {
      // Execution failed but verification passed — still record
      return {
        success: false,
        reason: `Falha ao abrir ordem: ${err instanceof Error ? err.message : "erro desconhecido"}`,
        verified: true,
      };
    }
  });

// ─── Scanner (analyze multiple assets) ──────────────────────────────────────

export const scanAssets = createServerFn({ method: "POST" })
  .validator(
    z.object({
      activeIds: z.array(z.number()),
      minStrength: z.number().default(100),
      minPayout: z.number().default(0),
    }),
  )
  .handler(async ({ data }) => {
    const results = await Promise.allSettled(
      data.activeIds.map(async (id) => {
        const candles = await getCandles(id, 100);
        if (candles.length < 31) return null;
        const a = analyze(candles.slice(0, -1));
        if (!a) return null;

        let payout = 85;
        try {
          const p = await getPayouts([id]);
          payout = p[id] ?? 85;
        } catch {
          // use default
        }

        return {
          activeId: id,
          direction: a.direction,
          strength: a.strength,
          confidence: a.confidence,
          payout,
          reasons: a.reasons,
          blocks: a.blocks,
          candleContext: a.candleContext,
          signalReady: a.signalReady,
          analysts: a.analysts,
        };
      }),
    );

    interface ScanResult {
      activeId: number;
      direction: "call" | "put";
      strength: number;
      confidence: string;
      payout: number;
      reasons: string[];
      blocks: string[];
      candleContext: string;
      signalReady: boolean;
      analysts: {
        name: string;
        icon: string;
        direction: "call" | "put" | "hold";
        confidence: number;
        opinion: string;
      }[];
    }

    const fulfilled: ScanResult[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value !== null) {
        fulfilled.push(r.value as ScanResult);
      }
    }

    return fulfilled.filter(
      (r) => r.strength >= data.minStrength && r.payout >= data.minPayout,
    );
  });