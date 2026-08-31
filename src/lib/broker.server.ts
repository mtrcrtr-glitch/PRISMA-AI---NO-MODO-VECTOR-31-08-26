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
// Lets the user connect using the live session from trade.optgobroker.com,
// bypassing the REST login (which is rate-limited after too many attempts).

let overrideSsid: string | null = null;
let overrideSsidAt = 0;
const OVERRIDE_TTL = 12 * 60 * 60 * 1000; // 12 hours

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
}

export function getSsidOverride(): string | null {
  // 1) Module override set at runtime (via the "Conectar com minha sessão" panel)
  if (overrideSsid) {
    if (Date.now() - overrideSsidAt > OVERRIDE_TTL) {
      overrideSsid = null;
    } else {
      return overrideSsid;
    }
  }
  // 2) Persistent override from env (live session pasted into .env)
  const envSsid = process.env["OPTGO_BROKER_SSID"];
  if (envSsid && envSsid.trim().length >= 10) return envSsid.trim();
  return null;
}

export async function getSsid(): Promise<string> {
  const now = Date.now();
  const ov = getSsidOverride();
  if (ov) return ov;
  if (cachedSsid && now - cachedSsidAt < 4 * 60 * 1000) return cachedSsid;

  const email = process.env["OPTGO_BROKER_EMAIL"] ?? "";
  const password = process.env["OPTGO_BROKER_PASSWORD"] ?? "";

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

  // Handle rate limit explicitly
  if (res.status === 429 || res.status === 200) {
    const json = (await res.json()) as {
      data?: { token?: string; ttl?: number };
      errors?: { code: number; title: string }[];
    };

    // Check for errors first
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
      throw new Error(`LOGIN_ERROR:${err?.title ?? "Erro desconhecido"}`);
    }

    const ssid = json?.data?.token;
    if (!ssid) throw new Error("LOGIN_NO_TOKEN:Resposta sem token de sessão");

    cachedSsid = ssid;
    cachedSsidAt = now;
    return ssid;
  }

  if (!res.ok) throw new Error(`LOGIN_HTTP_${res.status}:Erro HTTP ${res.status} no login`);

  const json = (await res.json()) as { data?: { token?: string } };
  const ssid = json?.data?.token;
  if (!ssid) throw new Error("LOGIN_NO_TOKEN:Resposta sem token de sessão");

  cachedSsid = ssid;
  cachedSsidAt = now;
  return ssid;
}

// ─── WebSocket helper ────────────────────────────────────────────────────────

// ─── Persistent WebSocket connection ────────────────────────────────────────
// A single connection is kept open and reused for every request, so there is no
// per-request handshake/auth delay — this keeps the robot in real time (no ~5s
// lag) even at the exact moment a new candle is born.

type WsMsg = Record<string, unknown>;

let persistentWs: WebSocket | null = null;
let persistentSsid = "";
let persistentSeq = 0;
let persistentReady: Promise<WebSocket> | null = null;
const persistentPending = new Map<string, (m: WsMsg) => void>();

let lastProfile: WsMsg | null = null;
const profileResolvers: ((p: WsMsg) => void)[] = [];

function setProfile(p: WsMsg) {
  lastProfile = p;
  let r;
  while ((r = profileResolvers.shift())) r(p);
}

function waitForProfile(timeoutMs: number): Promise<WsMsg> {
  if (lastProfile) return Promise.resolve(lastProfile);
  return new Promise((resolve, reject) => {
    const onDone = (p: WsMsg) => {
      clearTimeout(t);
      resolve(p);
    };
    const t = setTimeout(() => {
      const idx = profileResolvers.indexOf(onDone);
      if (idx >= 0) profileResolvers.splice(idx, 1);
      reject(new Error("Profile timeout"));
    }, timeoutMs);
    profileResolvers.push(onDone);
  });
}

function failPending(reason: string) {
  for (const cb of persistentPending.values()) cb({ name: "error", msg: reason } as WsMsg);
  persistentPending.clear();
}

function getWs(ssid: string): Promise<WebSocket> {
  if (persistentWs && persistentSsid === ssid && persistentWs.readyState === WebSocket.OPEN) {
    return Promise.resolve(persistentWs);
  }
  if (persistentReady) return persistentReady;

  persistentReady = new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    persistentWs = ws;
    persistentSsid = ssid;
    let authed = false;

    const timeout = setTimeout(() => {
      ws.close();
      persistentReady = null;
      reject(new Error("WS auth timeout"));
    }, 12000);

    ws.addEventListener("open", () => ws.send(JSON.stringify({ name: "ssid", msg: ssid })));

    ws.addEventListener("message", (ev) => {
      let parsed: WsMsg;
      try {
        parsed = JSON.parse(ev.data as string) as WsMsg;
      } catch {
        return;
      }

      if (parsed.name === "profile") {
        if (parsed.msg === false) {
          clearTimeout(timeout);
          ws.close();
          persistentWs = null;
          persistentReady = null;
          cachedSsid = null;
          failPending("Profile auth failed");
          reject(new Error("Profile auth failed"));
          return;
        }
        if (parsed.msg && typeof parsed.msg === "object") setProfile(parsed.msg as WsMsg);
        if (!authed) {
          authed = true;
          clearTimeout(timeout);
          resolve(ws);
        }
        return;
      }

      const rid = parsed.request_id;
      if (typeof rid === "string") {
        const cb = persistentPending.get(rid);
        if (cb) {
          persistentPending.delete(rid);
          cb(parsed);
        }
      }
    });

    ws.addEventListener("error", () => {
      clearTimeout(timeout);
      persistentReady = null;
      reject(new Error("WS connection error"));
    });

    ws.addEventListener("close", () => {
      persistentReady = null;
      persistentWs = null;
      failPending("WS closed");
    });
  });

  return persistentReady;
}

function wsRequest(
  ssid: string,
  body: WsMsg,
  onMsg: (m: WsMsg) => boolean,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const reqId = `${Date.now()}_${++persistentSeq}`;
    const timer = setTimeout(() => {
      persistentPending.delete(reqId);
      reject(new Error("Request timeout"));
    }, timeoutMs);
    persistentPending.set(reqId, (m) => {
      if (m.name === "error") {
        clearTimeout(timer);
        persistentPending.delete(reqId);
        reject(new Error(String(m.msg ?? "WS error")));
        return;
      }
      if (onMsg(m)) {
        clearTimeout(timer);
        persistentPending.delete(reqId);
        resolve();
      }
    });
    getWs(ssid)
      .then((ws) =>
        ws.send(
          JSON.stringify({ name: "sendMessage", request_id: reqId, msg: body }),
        ),
      )
      .catch((err: unknown) => {
        clearTimeout(timer);
        persistentPending.delete(reqId);
        reject(err);
      });
  });
}

// ─── Candles ─────────────────────────────────────────────────────────────────

/**
 * Parses the broker's candle payload, which may arrive either as an array
 * or as an object shaped like `{ candles: [...] }`.
 */
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

export async function getCandles(
  activeId: number,
  count = 150,
): Promise<Candle[]> {
  const ssid = await getSsid();
  let out: Candle[] = [];

  await wsRequest(
    ssid,
    { name: "get-candles", version: "2.0", body: { active_id: activeId, size: 60, duration: 60 } },
    (m) => {
      if (m.name === "candles" || m.name === "history") {
        out = parseCandlesMsg(m.msg).slice(-count);
        return true;
      }
      return false;
    },
    15000,
  );

  return out;
}

// ─── Live tick (current price) ───────────────────────────────────────────────

export interface Tick {
  time: number; // unix seconds of the tick's candle
  price: number;
  candles: Candle[]; // recent 1-second candles (bull/bear force feed)
}

/**
 * Fast live price: fetches 1-second candles (size=1, duration=1) and returns
 * the most recent price. Much quicker than the full 1M fetch (~500ms), so the
 * frontend can poll it every ~2s to keep the forming candle moving in real time.
 */
export async function getTick(activeId: number): Promise<Tick | null> {
  const ssid = await getSsid();
  const reqId1 = `${Date.now()}_t1_${++persistentSeq}`; // 1-second candles (live)
  const reqId2 = `${Date.now()}_t2_${++persistentSeq}`; // fallback: 1-minute candles

  return new Promise<Tick | null>((resolve) => {
    const timer = setTimeout(() => {
      persistentPending.delete(reqId1);
      persistentPending.delete(reqId2);
      resolve(null);
    }, 8000);

    let ws: WebSocket | null = null;
    let fallbackSent = false;

    const handler = (m: WsMsg) => {
      if (m.request_id === reqId1) {
        const candles = parseCandlesMsg(m.msg);
        if (candles.length) {
          clearTimeout(timer);
          persistentPending.delete(reqId1);
          persistentPending.delete(reqId2);
          const last = candles[candles.length - 1];
          resolve({ time: last.time, price: last.close, candles: candles.slice(-90) });
          return;
        }
        if (!fallbackSent) {
          // Some OTC assets don't return the 1-second feed. Fall back to the
          // 1-minute candles so the live price still moves for every asset.
          fallbackSent = true;
          ws?.send(
            JSON.stringify({
              name: "sendMessage",
              request_id: reqId2,
              msg: {
                name: "get-candles",
                version: "2.0",
                body: { active_id: activeId, size: 60, duration: 60 },
              },
            }),
          );
        }
      } else if (m.request_id === reqId2) {
        const candles = parseCandlesMsg(m.msg);
        clearTimeout(timer);
        persistentPending.delete(reqId1);
        persistentPending.delete(reqId2);
        if (candles.length) {
          const last = candles[candles.length - 1];
          resolve({ time: last.time, price: last.close, candles: [] });
        } else {
          resolve(null);
        }
      }
    };

    persistentPending.set(reqId1, handler);
    persistentPending.set(reqId2, handler);

    getWs(ssid)
      .then((w) => {
        ws = w;
        w.send(
          JSON.stringify({
            name: "sendMessage",
            request_id: reqId1,
            msg: {
              name: "get-candles",
              version: "2.0",
              body: { active_id: activeId, size: 1, duration: 1 },
            },
          }),
        );
      })
      .catch(() => {
        clearTimeout(timer);
        persistentPending.delete(reqId1);
        persistentPending.delete(reqId2);
        resolve(null);
      });
  });
}

// ─── Account ─────────────────────────────────────────────────────────────────

export async function getAccount(): Promise<AccountInfo> {
  const ssid = await getSsid();
  await getWs(ssid);
  const p = await waitForProfile(12000);

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
}

// ─── Payout ──────────────────────────────────────────────────────────────────

export async function getPayouts(activeIds: number[]): Promise<Record<number, number>> {
  const ssid = await getSsid();
  let result: Record<number, number> = {};

  await wsRequest(
    ssid,
    { name: "get-commissions", version: "1.0", body: { active_ids: activeIds } },
    (m) => {
      if (m.name === "commissions" || m.name === "get-commissions") {
        const data = (m.msg ?? m.data) as Record<string, unknown> | undefined;
        if (data && typeof data === "object") {
          for (const [k, v] of Object.entries(data)) {
            const id = parseInt(k, 10);
            if (!isNaN(id) && typeof v === "number") {
              result[id] = Math.round((1 - v) * 100);
            }
          }
        }
        return true;
      }
      return false;
    },
    10000,
  ).catch(() => {
    result = {};
  });

  return result;
}

// ─── Order execution ─────────────────────────────────────────────────────────

export async function openOption(params: {
  activeId: number;
  direction: "call" | "put";
  amount: number;
  duration: number;
  isDemo: boolean;
}): Promise<OrderResult> {
  const ssid = await getSsid();

  await wsRequest(
    ssid,
    {
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
    },
    (m) => {
      if (m.name === "option-opened" || m.name === "buy-complete" || m.name === "option") {
        return true;
      }
      return false;
    },
    15000,
  );

  return {
    id: String(Date.now()),
    activeId: params.activeId,
    direction: params.direction,
    amount: params.amount,
    openPrice: 0,
    openTime: Date.now() / 1000,
    expiration: params.duration,
    isDemo: params.isDemo,
  };
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
    candles = await getCandles(activeId, 30);
  } catch {
    return { ok: false, reason: "Não foi possível obter velas ao vivo", liveDir: null };
  }

  if (candles.length < 5) {
    return { ok: false, reason: "Dados insuficientes para verificação", liveDir: null };
  }

  const last5 = candles.slice(-5);
  const closes = last5.map((c) => c.close);
  const up = closes.filter((c, i) => i > 0 && c > closes[i - 1]).length;
  const liveDir: "call" | "put" = up >= 3 ? "call" : "put";

  if (liveDir !== expectedDir) {
    return {
      ok: false,
      reason: `Sinal virou ao vivo: mercado indica ${liveDir.toUpperCase()}`,
      liveDir,
    };
  }

  // Check last CLOSED candle color (the forming candle is still moving and
  // should not block the entry at the moment of birth)
  const lastClosed = candles[candles.length - 2] ?? candles[candles.length - 1];
  const candleColor = lastClosed.close >= lastClosed.open ? "call" : "put";
  if (candleColor !== expectedDir) {
    return {
      ok: false,
      reason: `Vela atual na cor contrária (${candleColor === "call" ? "verde" : "vermelha"})`,
      liveDir,
    };
  }

  return { ok: true, reason: "Verificação ok — sinal confirmado ao vivo", liveDir };
}