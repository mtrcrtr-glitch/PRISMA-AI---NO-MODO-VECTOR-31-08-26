/**
 * OPTGO Broker client — server-only
 * Handles: REST login, WebSocket candles, account info, order execution
 */

const LOGIN_URL = "https://auth.trade.optgobroker.com/api/v1.0/login";
const WS_URL = "wss://ws.trade.optgobroker.com/echo/websocket";

export interface Candle {
  time: number; // unix seconds (candle open time)
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface AccountInfo {
  id: number;
  name: string;
  balance: number;
  demoBalance: number;
  currency: string;
  country: number;
}

export interface OrderResult {
  id: string;
  activeId: number;
  direction: "call" | "put";
  amount: number;
  openPrice: number;
  openTime: number;
  expiration: number; // seconds
  isDemo: boolean;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

let cachedSsid: string | null = null;
let cachedSsidAt = 0;

// ─── SSID override (from the broker site's browser session) ─────────────────
let overrideSsid: string | null = null;
let overrideSsidAt = 0;
const OVERRIDE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function setSsidOverride(ssid: string): void {
  const clean = ssid.trim();
  overrideSsid = clean;
  overrideSsidAt = Date.now();
  if (clean) {
    cachedSsid = clean;
    cachedSsidAt = Date.now();
  }
}

export function clearSsidOverride(): void {
  overrideSsid = null;
  overrideSsidAt = 0;
  cachedSsid = null;
  cachedSsidAt = 0;
}

export function getSsidOverride(): string | null {
  // 1) Module override set at runtime (via the "Conectar com minha sessão" panel)
  if (overrideSsid && overrideSsid.length >= 10) {
    if (Date.now() - overrideSsidAt > OVERRIDE_TTL) {
      overrideSsid = null;
    } else {
      return overrideSsid;
    }
  }
  // 2) Persistent override from env (live session in .env)
  const envSsid = process.env["OPTGO_BROKER_SSID"];
  if (envSsid && envSsid.trim().length >= 10) return envSsid.trim();
  return null;
}

export async function getSsid(): Promise<string> {
  const now = Date.now();
  const ov = getSsidOverride();
  if (ov) return ov;
  if (cachedSsid && now - cachedSsidAt < 15 * 60 * 1000) return cachedSsid;

  const email = process.env["OPTGO_BROKER_EMAIL"] ?? "";
  const password = process.env["OPTGO_BROKER_PASSWORD"] ?? "";

  if (!email || !password) {
    throw new Error("LOGIN_NO_CREDS:Email ou senha da corretora não configurados");
  }

  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Origin: "https://trade.optgobroker.com",
      Referer: "https://trade.optgobroker.com/",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
    },
    body: JSON.stringify({ email, password }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    data?: { token?: string; ssid?: string; ttl?: number };
    errors?: { code: number; title: string }[];
  };

  // Handle rate limit or error response
  if (json.errors && json.errors.length > 0) {
    const err = json.errors[0];
    if (err?.code === 301) {
      const ttl = json.data?.ttl ?? 3600;
      const mins = Math.ceil(ttl / 60);
      throw new Error(
        `LOGIN_RATE_LIMITED:${mins}:IP bloqueado temporariamente pela corretora. Aguarde ${mins} minuto${mins > 1 ? "s" : ""}.`,
      );
    }
    if (err?.code === 1 || err?.code === 2) {
      throw new Error("LOGIN_INVALID:Email ou senha incorretos");
    }
    throw new Error(`LOGIN_ERROR:${err?.title ?? "Erro no login"}`);
  }

  const ssid = json?.data?.ssid ?? json?.data?.token;
  if (!ssid) {
    if (!res.ok) {
      throw new Error(`LOGIN_HTTP_${res.status}:Erro HTTP ${res.status} no login da corretora`);
    }
    throw new Error("LOGIN_NO_TOKEN:Resposta da corretora sem token de sessão");
  }

  cachedSsid = ssid;
  cachedSsidAt = now;
  return ssid;
}

// ─── Scoped WebSocket Runner ────────────────────────────────────────────────
// In Cloudflare Workers / serverless runtimes, each request handler must execute
// I/O within its own scope. withBrokerWs opens a connection, authenticates,
// runs the user callback with a request helper, and guarantees clean teardown.

type WsMsg = Record<string, unknown>;

export interface BrokerSession {
  ws: WebSocket;
  profile: WsMsg;
  sendReq: (body: WsMsg, timeoutMs?: number) => Promise<WsMsg>;
  waitFor: (predicate: (m: WsMsg) => boolean, timeoutMs?: number) => Promise<WsMsg>;
}

let requestSeq = 0;

export async function withBrokerWs<T>(
  callback: (session: BrokerSession) => Promise<T>,
): Promise<T> {
  const ssid = await getSsid();

  return new Promise<T>((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let isDone = false;
    const pendingRequests = new Map<string, (msg: WsMsg) => void>();
    const generalWaiters: Array<{ predicate: (m: WsMsg) => boolean; resolve: (m: WsMsg) => void }> = [];

    const cleanup = () => {
      if (isDone) return;
      isDone = true;
      try {
        ws.close();
      } catch {
        // ignore
      }
    };

    const overallTimeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout ao comunicar com a corretora"));
    }, 15000);

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ name: "ssid", msg: ssid }));
    });

    ws.addEventListener("error", (err) => {
      cleanup();
      clearTimeout(overallTimeout);
      reject(new Error(`Erro de conexão WebSocket: ${err instanceof Error ? err.message : "Falha na conexão"}`));
    });

    ws.addEventListener("message", (ev) => {
      let parsed: WsMsg;
      try {
        parsed = JSON.parse(ev.data as string) as WsMsg;
      } catch {
        return;
      }

      // Check for authentication result
      if (parsed.name === "profile") {
        if (parsed.msg === false) {
          cleanup();
          clearTimeout(overallTimeout);
          cachedSsid = null;
          overrideSsid = null;
          reject(new Error("Sessão da corretora expirada ou inválida. Reconecte seu SSID."));
          return;
        }

        const profileData = (parsed.msg && typeof parsed.msg === "object" ? parsed.msg : {}) as WsMsg;

        const session: BrokerSession = {
          ws,
          profile: profileData,
          sendReq: (body: WsMsg, timeoutMs = 10000) => {
            return new Promise<WsMsg>((reqRes, reqRej) => {
              const reqId = `${Date.now()}_${++requestSeq}`;
              const t = setTimeout(() => {
                pendingRequests.delete(reqId);
                reqRej(new Error(`Timeout na requisição ${String(body.name ?? "")}`));
              }, timeoutMs);

              pendingRequests.set(reqId, (responseMsg) => {
                clearTimeout(t);
                reqRes(responseMsg);
              });

              try {
                ws.send(JSON.stringify({ name: "sendMessage", request_id: reqId, msg: body }));
              } catch (sendErr) {
                clearTimeout(t);
                pendingRequests.delete(reqId);
                reqRej(sendErr);
              }
            });
          },
          waitFor: (predicate, timeoutMs = 8000) => {
            return new Promise<WsMsg>((wRes, wRej) => {
              const t = setTimeout(() => {
                const idx = generalWaiters.findIndex((w) => w.resolve === wRes);
                if (idx >= 0) generalWaiters.splice(idx, 1);
                wRej(new Error("Timeout aguardando mensagem da corretora"));
              }, timeoutMs);

              generalWaiters.push({
                predicate,
                resolve: (m) => {
                  clearTimeout(t);
                  wRes(m);
                },
              });
            });
          },
        };

        // Run user callback
        callback(session)
          .then((res) => {
            clearTimeout(overallTimeout);
            cleanup();
            resolve(res);
          })
          .catch((err) => {
            clearTimeout(overallTimeout);
            cleanup();
            reject(err);
          });
        return;
      }

      // Check request ID matches
      const rid = typeof parsed.request_id === "string" ? parsed.request_id : undefined;
      if (rid && pendingRequests.has(rid)) {
        const handler = pendingRequests.get(rid)!;
        pendingRequests.delete(rid);
        handler(parsed);
        return;
      }

      // Check general waiters
      for (let i = generalWaiters.length - 1; i >= 0; i--) {
        const w = generalWaiters[i];
        if (w.predicate(parsed)) {
          generalWaiters.splice(i, 1);
          w.resolve(parsed);
          break;
        }
      }
    });
  });
}

// ─── Candles ─────────────────────────────────────────────────────────────────

function parseCandlesMsg(msg: unknown): Candle[] {
  let raw: unknown;
  if (Array.isArray(msg)) raw = msg;
  else raw = (msg as { candles?: unknown } | null | undefined)?.candles;
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (c): c is { from?: number; open?: number; max?: number; min?: number; close?: number } =>
        Boolean(c && typeof (c as { from?: number }).from === "number"),
    )
    .map((c) => ({
      time: c.from as number,
      open: Number(c.open ?? 0),
      high: Number(c.max ?? c.open ?? 0),
      low: Number(c.min ?? c.open ?? 0),
      close: Number(c.close ?? 0),
    }));
}

export async function getCandles(activeId: number, count = 150): Promise<Candle[]> {
  return withBrokerWs(async (session) => {
    const res = await session.sendReq({
      name: "get-candles",
      version: "2.0",
      body: { active_id: activeId, size: 60, duration: 60 },
    });
    return parseCandlesMsg(res.msg).slice(-count);
  });
}

// ─── Live tick (current price) ───────────────────────────────────────────────

export interface Tick {
  time: number;
  price: number;
  candles: Candle[];
}

export async function getTick(activeId: number): Promise<Tick | null> {
  try {
    return await withBrokerWs(async (session) => {
      try {
        const res1 = await session.sendReq(
          {
            name: "get-candles",
            version: "2.0",
            body: { active_id: activeId, size: 1, duration: 1 },
          },
          4000,
        );
        const candles = parseCandlesMsg(res1.msg);
        if (candles.length > 0) {
          const last = candles[candles.length - 1];
          return { time: last.time, price: last.close, candles: candles.slice(-90) };
        }
      } catch {
        // Fall back to 1M candles
      }

      const res2 = await session.sendReq({
        name: "get-candles",
        version: "2.0",
        body: { active_id: activeId, size: 60, duration: 60 },
      });
      const candles = parseCandlesMsg(res2.msg);
      if (candles.length > 0) {
        const last = candles[candles.length - 1];
        return { time: last.time, price: last.close, candles: [] };
      }
      return null;
    });
  } catch {
    return null;
  }
}

// ─── Account ─────────────────────────────────────────────────────────────────

export async function getAccount(): Promise<AccountInfo> {
  return withBrokerWs(async (session) => {
    const p = session.profile;
    const balances = (p.balances as Record<string, unknown>[] | undefined) ?? [];
    let realBal = 0;
    let demoBal = 0;
    for (const b of balances) {
      if (b.type === 1) realBal = Number(b.amount ?? 0);
      if (b.type === 4) demoBal = Number(b.amount ?? 0);
    }

    return {
      id: Number(p.id ?? 0),
      name: String(p.name ?? ""),
      balance: realBal,
      demoBalance: demoBal,
      currency: String(p.currency ?? "USD"),
      country: Number(p.country_id ?? 0),
    };
  });
}

// ─── Payout ──────────────────────────────────────────────────────────────────

export async function getPayouts(activeIds: number[]): Promise<Record<number, number>> {
  try {
    return await withBrokerWs(async (session) => {
      const res = await session.sendReq({
        name: "get-commissions",
        version: "1.0",
        body: { active_ids: activeIds },
      });
      const data = (res.msg ?? res.data) as Record<string, unknown> | undefined;
      const result: Record<number, number> = {};
      if (data && typeof data === "object") {
        for (const [k, v] of Object.entries(data)) {
          const id = parseInt(k, 10);
          if (!isNaN(id) && typeof v === "number") {
            result[id] = Math.round((1 - v) * 100);
          }
        }
      }
      return result;
    });
  } catch {
    return {};
  }
}

// ─── Order execution ─────────────────────────────────────────────────────────

export async function openOption(params: {
  activeId: number;
  direction: "call" | "put";
  amount: number;
  duration: number;
  isDemo: boolean;
}): Promise<OrderResult> {
  return withBrokerWs(async (session) => {
    const res = await session.sendReq({
      name: "buy-back",
      version: "1.0",
      body: {
        active_id: params.activeId,
        direction: params.direction,
        option_type_id: 3,
        price: params.amount,
        duration: params.duration,
        profit_percent: 100,
        user_balance_id: params.isDemo ? 4 : 1,
      },
    });

    const msg = (res.msg ?? {}) as Record<string, unknown>;
    const orderId = String(msg.id ?? msg.option_id ?? Date.now());
    const openPrice = Number(msg.value ?? msg.open_quote ?? 0);

    return {
      id: orderId,
      activeId: params.activeId,
      direction: params.direction,
      amount: params.amount,
      openPrice,
      openTime: Date.now() / 1000,
      expiration: params.duration,
      isDemo: params.isDemo,
    };
  });
}

// ─── Pre-trade live verification ─────────────────────────────────────────────

export interface VerifyResult {
  ok: boolean;
  reason: string;
  liveDir: "call" | "put" | null;
}

export async function verifySignal(
  activeId: number,
  expectedDir: "call" | "put",
): Promise<VerifyResult> {
  let candles: Candle[];
  try {
    candles = await getCandles(activeId, 120);
  } catch {
    return { ok: false, reason: "Não foi possível obter velas ao vivo", liveDir: null };
  }

  if (candles.length < 35) {
    return { ok: false, reason: "Dados insuficientes para verificação", liveDir: null };
  }

  const { evaluateTaxaDividida } = await import("#/lib/taxa-dividida.ts");
  // Evaluate the closed candles (before forming candle)
  const closed = candles.slice(0, -1);
  const evalResult = evaluateTaxaDividida(closed);

  if (!evalResult) {
    return { ok: false, reason: "Falha na análise Taxa Dividida", liveDir: null };
  }

  if (evalResult.buyOK && expectedDir === "call") {
    return {
      ok: true,
      reason: "Taxa Dividida v3: Sinal de COMPRA confirmado!",
      liveDir: "call",
    };
  }

  if (evalResult.sellOK && expectedDir === "put") {
    return {
      ok: true,
      reason: "Taxa Dividida v3: Sinal de VENDA confirmado!",
      liveDir: "put",
    };
  }

  if (evalResult.armedBuy && expectedDir === "call") {
    return {
      ok: true,
      reason: "Taxa Dividida v3: Setup Compra armado e aceito",
      liveDir: "call",
    };
  }

  if (evalResult.armedSell && expectedDir === "put") {
    return {
      ok: true,
      reason: "Taxa Dividida v3: Setup Venda armado e aceito",
      liveDir: "put",
    };
  }

  return {
    ok: false,
    reason: `Setup não confirmado no momento (${evalResult.statusText})`,
    liveDir: evalResult.direction,
  };
}
