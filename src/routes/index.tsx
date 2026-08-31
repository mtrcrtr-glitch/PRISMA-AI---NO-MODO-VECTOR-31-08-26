import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { fetchAccount, fetchAssets, testConnection } from "#/lib/otc.functions.ts";
import type { OtcAsset } from "#/lib/otc-assets.ts";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [assets, account, connTest] = await Promise.allSettled([
      fetchAssets(),
      fetchAccount(),
      testConnection(),
    ]);
    return {
      assets: assets.status === "fulfilled" ? assets.value : [],
      account: account.status === "fulfilled" ? account.value : null,
      conn: connTest.status === "fulfilled" ? connTest.value : null,
    };
  },
  component: HomePage,
});

function HomePage() {
  const { assets, account, conn } = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();

  const connOk = conn?.ok === true;
  const connAccount = connOk
    ? (conn as { ok: true; account: { name: string; balance: number; demoBalance: number; currency: string } }).account
    : null;
  const displayAccount = connAccount ?? account;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Connection status banner */}
      {conn && (
        <div
          className={`px-4 py-2 text-xs font-medium flex items-center gap-3 ${
            conn.ok
              ? "bg-emerald-900/60 text-emerald-300 border-b border-emerald-800/50"
              : (conn as { rateLimited?: boolean }).rateLimited
                ? "bg-orange-900/60 text-orange-300 border-b border-orange-800/50"
                : "bg-red-900/60 text-red-300 border-b border-red-800/50"
          }`}
        >
          <span>{conn.ok ? "✅" : (conn as { rateLimited?: boolean }).rateLimited ? "⏳" : "❌"}</span>
          <span className="font-semibold">{conn.message}</span>
          {conn.detail && (
            <span className="text-opacity-70 text-current opacity-70">{conn.detail}</span>
          )}
          {connAccount && (
            <>
              <span className="ml-auto">Demo: <strong className="text-emerald-400">${connAccount.demoBalance.toFixed(2)}</strong></span>
              <span>Real: <strong className="text-yellow-400">${connAccount.balance.toFixed(2)}</strong></span>
              <span className="text-current opacity-60">{connAccount.currency}</span>
            </>
          )}
        </div>
      )}

      {/* Session connect panel (shown when not connected) */}
      {!connOk && <SsidConnectPanel onConnected={() => void router.invalidate()} />}

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-sm text-black">
            R
          </div>
          <span className="font-bold text-lg tracking-tight">RoboSignal OTC</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${connOk ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
            {connOk ? "AO VIVO" : "OFFLINE"}
          </span>
        </div>
        {displayAccount && (
          <div className="flex items-center gap-3 text-sm">
            <div className="hidden sm:flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-lg">
              <span className="text-gray-400">Demo</span>
              <span className="font-semibold text-emerald-400">
                ${displayAccount.demoBalance.toFixed(2)}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-lg">
              <span className="text-gray-400">Real</span>
              <span className="font-semibold text-yellow-400">
                ${displayAccount.balance.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${connOk ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
              <span className="text-gray-300 text-xs">{displayAccount.name.split(" ")[0]}</span>
            </div>
          </div>
        )}
      </header>

      {/* Nav */}
      <nav className="border-b border-gray-800 bg-gray-900/60 px-4">
        <div className="flex gap-1">
          <button
            onClick={() => void navigate({ to: "/" })}
            className="px-4 py-2.5 text-sm font-medium text-emerald-400 border-b-2 border-emerald-400"
          >
            📊 OTC ao Vivo
          </button>
          <button
            onClick={() => void navigate({ to: "/scanner" })}
            className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white border-b-2 border-transparent hover:border-gray-600 transition-colors"
          >
            🔍 Auto Scanner
          </button>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar - asset list */}
        <aside className="w-56 lg:w-64 border-r border-gray-800 bg-gray-900/40 overflow-y-auto flex-shrink-0">
          <div className="p-3 border-b border-gray-800">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
              Ativos OTC ({assets.length})
            </p>
          </div>
          <div className="py-1">
            {["forex", "stock", "crypto"].map((cat) => {
              const catAssets = assets.filter((a) => a.category === cat);
              if (!catAssets.length) return null;
              return (
                <div key={cat}>
                  <div className="px-3 py-1.5 text-xs text-gray-500 uppercase font-semibold tracking-wider">
                    {cat === "forex" ? "💱 Forex" : cat === "stock" ? "📈 Ações" : "🪙 Crypto"}
                  </div>
                  {catAssets.map((asset) => (
                    <AssetRow key={asset.id} asset={asset} />
                  ))}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Chart & Signal area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <OtcPanel assets={assets} live={connOk} />
        </main>
      </div>
    </div>
  );
}

// ─── Session (SSID) connect panel ────────────────────────────────────────────

function SsidConnectPanel({ onConnected }: { onConnected: () => void }) {
  const [open, setOpen] = useState(false);
  const [ssid, setSsid] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; hint?: string } | null>(null);

  async function handleConnect() {
    if (!ssid.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const { connectWithSsid } = await import("#/lib/otc.functions.ts");
      const res = await connectWithSsid({ data: { ssid: ssid.trim() } });
      if (res.ok) {
        setMsg({ ok: true, text: "✅ Conectado! Atualizando dados..." });
        setTimeout(onConnected, 900);
      } else {
        setMsg({
          ok: false,
          text: `${res.message}${res.detail ? ` — ${res.detail}` : ""}`,
          hint: res.hint,
        });
      }
    } catch {
      setMsg({ ok: false, text: "Erro de comunicação ao conectar" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-3 bg-sky-950/50 border-b border-sky-900/60">
      <div className="max-w-3xl">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-sky-300 hover:text-sky-200"
        >
          <span>🔑 Conectar com minha sessão do site</span>
          <span className="text-sky-500">{open ? "▲" : "▼"}</span>
        </button>

        {open && (
          <div className="mt-3 bg-gray-900/80 border border-sky-900/60 rounded-xl p-4 text-sm">
            <p className="text-gray-300 leading-relaxed">
              O login automático está temporariamente bloqueado pela corretora (espera de ~60
              min). Mas você está <strong className="text-white">logado no site</strong> — use a
              sua sessão atual para conectar o robô <strong className="text-white">agora</strong>:
            </p>
            <ol className="mt-2 space-y-1 text-gray-400 list-decimal list-inside">
              <li>Abra <span className="text-sky-300">trade.optgobroker.com</span> logado.</li>
              <li>Aperte <strong className="text-white">F12</strong> (ferramentas do desenvolvedor).</li>
              <li>Vá na aba <strong className="text-white">Aplicativo</strong> (Application).</li>
              <li>Em <strong className="text-white">Cookies</strong>, clique em{" "}
                <span className="text-sky-300">https://trade.optgobroker.com</span>.</li>
              <li>Ache a linha <strong className="text-white">ssid</strong> e copie o{" "}
                <strong className="text-white">Valor</strong> (texto longo).</li>
              <li>Cole abaixo e clique em <strong className="text-white">Conectar</strong>.</li>
            </ol>

            <div className="mt-3 flex gap-2">
              <input
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
                placeholder="Cole o SSID aqui..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={() => void handleConnect()}
                disabled={busy || !ssid.trim()}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {busy ? "Conectando..." : "Conectar"}
              </button>
            </div>

            {msg && (
              <div
                className={`mt-2 text-xs ${
                  msg.ok ? "text-emerald-400" : "text-red-400"
                }`}
              >
                <p>{msg.text}</p>
                {msg.hint && <p className="mt-1 text-amber-300">{msg.hint}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AssetRow({ asset }: { asset: OtcAsset & { payout: number } }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() =>
        void navigate({
          to: "/",
          search: (prev: Record<string, string>) => ({ ...prev, asset: String(asset.id) }),
        })
      }
      className="w-full text-left px-3 py-2 hover:bg-gray-800/60 transition-colors flex items-center justify-between group"
    >
      <div>
        <p className="text-sm font-medium text-gray-200 group-hover:text-white leading-none">
          {asset.label.replace(" OTC", "")}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">OTC</p>
      </div>
      <span className="text-xs text-emerald-400 font-medium">{asset.payout}%</span>
    </button>
  );
}

// ─── Main OTC Panel ─────────────────────────────────────────────────────────

function OtcPanel({ assets, live }: { assets: (OtcAsset & { payout: number })[]; live?: boolean }) {
  const search = Route.useSearch();
  const assetId =
    search && "asset" in (search as Record<string, unknown>)
      ? Number((search as Record<string, string>).asset)
      : assets[0]?.id ?? 76;

  const asset = assets.find((a) => a.id === assetId) ?? assets[0];

  const [candles, setCandles] = useState<CandleData[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [entryAmount, setEntryAmount] = useState("1");
  const [isDemo, setIsDemo] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [lastExec, setLastExec] = useState<ExecRecord | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [nextTime, setNextTime] = useState("--:--:--");
  const [force, setForce] = useState<Force>({ bullPct: 50, bearPct: 50, winner: "bull", leader: 0 });
  const tickSeriesRef = useRef<CandleData[]>([]);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);

  interface CandleData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
  }

  interface AnalysisData {
    direction: "call" | "put";
    strength: number;
    confidence: string;
    reasons: string[];
    blocks: string[];
    ema9: number;
    ema21: number;
    rsi: number;
    bbUpper: number;
    bbLower: number;
    bbMid: number;
    lastPrice: number;
    trend: string;
    candleContext: string;
    nextDir: "call" | "put";
    nextProb: number;
    pattern: string;
    analysts: {
      name: string;
      icon: string;
      direction: "call" | "put";
      confidence: number;
      opinion: string;
    }[];
    signalReady: boolean;
  }

  interface ExecRecord {
    direction: "call" | "put";
    amount: number;
    verified: boolean;
    reason: string;
    time: string;
    success: boolean;
  }

  async function loadData() {
    if (!asset) return;
    setLoading(true);
    setError(null);
    try {
      const { fetchAnalysis } = await import("#/lib/otc.functions.ts");
      const result = await fetchAnalysis({ data: { activeId: asset.id } });
      if ("error" in result) {
        setError(result.error ?? "Erro desconhecido");
        setAnalysis(null);
        setCandles([]);
      } else {
        setAnalysis(result.analysis as AnalysisData);
        setCandles(result.candles as CandleData[]);
        setLivePrice((result.analysis as AnalysisData).lastPrice ?? null);
        setError(null);
      }
    } catch {
      setError("Falha ao conectar com a corretora");
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }

  // Analysis is generated exactly at the birth of each 1M candle (:00, on the
  // broker's minute boundary — displayed in Brasília time, UTC-3). Between
  // candles the chart stays live through the 2s tick feed, without re-analyzing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      const now = Math.floor(Date.now() / 1000);
      const msToBirth = (60 - (now % 60)) * 1000 + 200;
      timer = setTimeout(() => void run(), msToBirth);
    };

    const run = async () => {
      if (disposed) return;
      await loadData();
      if (!disposed) schedule();
    };

    void loadData(); // first view immediately
    schedule();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [assetId]);

  // Countdown to next candle (Brasília time, UTC-3)
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
    countRef.current = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      setCountdown(60 - (now % 60));
      const next = now + (60 - (now % 60));
      setNextTime(fmt.format(new Date(next * 1000)));
    }, 1000);
    return () => {
      if (countRef.current) clearInterval(countRef.current);
    };
  }, []);

  // Live tick: poll the current price every 2s and move the forming candle.
  // Also accumulates the 1s candles into a rolling bull/bear force gauge.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!live || !asset) return;
    let disposed = false;
    const poll = async () => {
      try {
        const { fetchTick } = await import("#/lib/otc.functions.ts");
        const tick = await fetchTick({ data: { activeId: asset.id } });
        if (disposed || !tick) return;
        setLivePrice(tick.price);
        setCandles((prev) => applyTick(prev, tick));

        if (tick.candles && tick.candles.length) {
          const map = new Map(tickSeriesRef.current.map((c) => [c.time, c]));
          for (const c of tick.candles) map.set(c.time, c);
          const arr = [...map.values()].sort((a, b) => a.time - b.time).slice(-60);
          tickSeriesRef.current = arr;
          setForce(computeForce(arr));
        }
      } catch {
        // ignore transient tick failures
      }
    };
    void poll();
    const iv = setInterval(() => void poll(), 2000);
    return () => {
      disposed = true;
      clearInterval(iv);
      tickSeriesRef.current = [];
    };
  }, [live, asset?.id]);

  // Periodic refresh of the REAL broker candles for the selected asset, so the
  // chart always matches the actual market (works for every asset, even when
  // the 1-second tick feed is unavailable for that pair).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!asset) return;
    let disposed = false;
    const refresh = async () => {
      try {
        const { fetchCandles } = await import("#/lib/otc.functions.ts");
        const cs = await fetchCandles({ data: { activeId: asset.id, count: 150 } });
        if (disposed || !cs || !cs.length) return;
        setCandles(cs as CandleData[]);
      } catch {
        // keep the last good candles
      }
    };
    void refresh();
    const iv = setInterval(() => void refresh(), 15000);
    return () => {
      disposed = true;
      clearInterval(iv);
    };
  }, [asset?.id]);

  async function handleExecute() {
    if (!analysis || !asset) return;
    setExecuting(true);
    try {
      const { executeOrder } = await import("#/lib/otc.functions.ts");
      const result = await executeOrder({
        data: {
          activeId: asset.id,
          direction: analysis.direction,
          amount: parseFloat(entryAmount) || 1,
          duration: 60,
          isDemo,
          skipVerify: false,
        },
      });
      setLastExec({
        direction: analysis.direction,
        amount: parseFloat(entryAmount) || 1,
        verified: result.verified ?? false,
        reason: result.reason ?? "",
        time: new Date().toLocaleTimeString("pt-BR"),
        success: result.success ?? false,
      });
    } catch {
      setLastExec({
        direction: analysis?.direction ?? "call",
        amount: parseFloat(entryAmount) || 1,
        verified: false,
        reason: "Erro de comunicação",
        time: new Date().toLocaleTimeString("pt-BR"),
        success: false,
      });
    } finally {
      setExecuting(false);
    }
  }

  if (!asset) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Nenhum ativo disponível
      </div>
    );
  }

  // Final next-candle projection: probability engine (180 candles + patterns)
  // from the analysis, refined live by the tick momentum (last ~15s).
  const mom = tickMomentum(tickSeriesRef.current);
  const momDir: "call" | "put" = mom >= 0 ? "call" : "put";
  const baseDir = analysis?.nextDir;
  const baseProb = analysis?.nextProb ?? 50;
  const previewDir: "call" | "put" = baseDir ?? momDir;
  let previewProb = baseProb;
  if (Math.abs(mom) > 0.05) {
    const shift = Math.round(Math.abs(mom) * 12);
    if (momDir === previewDir) previewProb = Math.min(95, previewProb + shift);
    else previewProb = Math.max(40, previewProb - shift);
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Asset header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-900/40">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="font-bold text-lg leading-none">{asset.label}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Payout{" "}
              <span className="text-emerald-400 font-semibold">{asset.payout}%</span>
              {" · "}
              Velas 1M
            </p>
          </div>
          {analysis && (
            <div className="text-2xl font-bold tabular-nums text-white flex items-center gap-2">
              <span>
                {(livePrice ?? analysis.lastPrice).toFixed(
                  (livePrice ?? analysis.lastPrice) > 100
                    ? 3
                    : (livePrice ?? analysis.lastPrice) > 10
                      ? 4
                      : 5,
                )}
              </span>
              <span
                className={`w-2 h-2 rounded-full animate-pulse ${
                  livePrice !== null ? "bg-sky-400" : "bg-gray-600"
                }`}
                title={livePrice !== null ? "Preço ao vivo" : "Atualizando..."}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-center bg-gray-800 px-3 py-1.5 rounded-lg">
            <div className="text-xs text-gray-500">Próxima vela · Brasília</div>
            <div className="text-lg font-bold tabular-nums text-orange-400">
              {nextTime}
              <span className="ml-1 text-xs font-medium text-gray-500">
                em {String(countdown).padStart(2, "0")}s
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Candlestick chart */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">Gráfico 1M</span>
                {loading && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <div className="w-3 h-3 border border-gray-600 border-t-emerald-400 rounded-full animate-spin" />
                    Atualizando
                  </div>
                )}
              </div>
              <div className="p-2">
                {/* Bulls vs Bears — who is winning in real time, plus the
                    verdict of the last closed 1M candle */}
                <div className="mb-2 rounded-lg bg-gray-900/60 border border-gray-800 px-3 py-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500 font-medium">
                      Ursos 🐻 × Touros 🐂 (tempo real)
                    </span>
                    <span
                      className="text-xs font-bold"
                      style={{ color: force.winner === "bull" ? "#22c55e" : "#ef4444" }}
                    >
                      {force.winner === "bull" ? "🐂 Touros" : "🐻 Ursos"} dominando
                      {force.leader > 0 ? ` +${force.leader}%` : ""}
                    </span>
                  </div>
                  <div className="flex h-5 rounded-full overflow-hidden bg-gray-800">
                    <div
                      className="bg-red-500/80 flex items-center justify-center text-[10px] font-bold text-white transition-all duration-500"
                      style={{ width: `${force.bearPct}%` }}
                    >
                      {force.bearPct >= 14 ? `${force.bearPct}%` : ""}
                    </div>
                    <div
                      className="bg-emerald-500/80 flex items-center justify-center text-[10px] font-bold text-black transition-all duration-500"
                      style={{ width: `${force.bullPct}%` }}
                    >
                      {force.bullPct >= 14 ? `${force.bullPct}%` : ""}
                    </div>
                  </div>
                  {closedCandleVerdict(candles) && (
                    <div className="mt-1.5 flex items-center justify-between text-xs">
                      <span className="text-gray-500">Última vela fechada (:00)</span>
                      <span
                        className="font-semibold"
                        style={{ color: closedCandleVerdict(candles)!.color }}
                      >
                        {closedCandleVerdict(candles)!.label} venceram com{" "}
                        {closedCandleVerdict(candles)!.pct}% de força
                      </span>
                    </div>
                  )}
                  {analysis?.pattern && (
                    <div className="mt-1.5 flex items-center justify-between text-xs">
                      <span className="text-gray-500">Padrão detectado</span>
                      <span className="font-semibold text-gray-300">{analysis.pattern}</span>
                    </div>
                  )}
                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <span className="text-gray-500">Próxima vela</span>
                    <span className="font-semibold" style={{ color: previewDir === "call" ? "#22c55e" : "#ef4444" }}>
                      {previewDir === "call" ? "▲ CALL" : "▼ PUT"} · {previewProb}%
                    </span>
                  </div>
                </div>

                {candles.length > 0 ? (
                  <CandlestickChart
                    candles={candles.slice(-60)}
                    ema9={analysis?.ema9}
                    ema21={analysis?.ema21}
                    bbUpper={analysis?.bbUpper}
                    bbMid={analysis?.bbMid}
                    bbLower={analysis?.bbLower}
                    nextOpen={livePrice ?? analysis?.lastPrice}
                    // Probability-based projection from all broker data
                    // (180 candles + patterns + ticks), not just the current color.
                    nextDir={previewDir}
                    nextProb={previewProb}
                  />
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-600">
                    {error ?? "Carregando gráfico..."}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Signal & Controls */}
          <div className="flex flex-col gap-4">
            {/* Signal box */}
            {error ? (
              <div className="bg-red-900/20 rounded-xl border border-red-800/40 p-4 text-center">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                  onClick={() => void loadData()}
                  className="mt-2 text-xs text-gray-400 hover:text-white underline"
                >
                  Tentar novamente
                </button>
              </div>
            ) : loading && !analysis ? (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-gray-700 border-t-emerald-400 rounded-full animate-spin" />
                <p className="text-sm text-gray-500">Analisando mercado...</p>
              </div>
            ) : analysis ? (
              <SignalBox
                analysis={analysis}
                onExecute={() => void handleExecute()}
                executing={executing}
                entryAmount={entryAmount}
                setEntryAmount={setEntryAmount}
                isDemo={isDemo}
                setIsDemo={setIsDemo}
                assetPayout={asset.payout}
              />
            ) : null}

            {/* Last execution */}
            {lastExec && (
              <div
                className={`rounded-xl border p-3 text-sm ${
                  lastExec.success
                    ? "bg-emerald-900/20 border-emerald-800/40"
                    : "bg-red-900/20 border-red-800/40"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs uppercase">
                    {lastExec.success ? "✅ Ordem aberta" : "❌ Não executada"}
                  </span>
                  <span className="text-xs text-gray-500">{lastExec.time}</span>
                </div>
                <p className="text-xs text-gray-400">{lastExec.reason}</p>
                {lastExec.success && (
                  <div className="mt-1.5 flex gap-2 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded font-semibold ${
                        lastExec.direction === "call"
                          ? "bg-emerald-500/30 text-emerald-300"
                          : "bg-red-500/30 text-red-300"
                      }`}
                    >
                      {lastExec.direction.toUpperCase()}
                    </span>
                    <span className="text-gray-400">${lastExec.amount.toFixed(2)}</span>
                    <span className="text-gray-400">{isDemo ? "DEMO" : "REAL"}</span>
                  </div>
                )}
              </div>
            )}

            {/* Indicators */}
            {analysis && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-3">
                <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Indicadores</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <IndicatorBadge
                    label="EMA9"
                    value={analysis.ema9.toFixed(4)}
                    color="text-cyan-400"
                  />
                  <IndicatorBadge
                    label="EMA21"
                    value={analysis.ema21.toFixed(4)}
                    color="text-yellow-400"
                  />
                  <IndicatorBadge
                    label="RSI"
                    value={analysis.rsi.toFixed(1)}
                    color={
                      analysis.rsi > 70
                        ? "text-red-400"
                        : analysis.rsi < 30
                          ? "text-emerald-400"
                          : "text-gray-300"
                    }
                  />
                  <IndicatorBadge
                    label="Tendência"
                    value={
                      analysis.trend === "up"
                        ? "Alta ↑"
                        : analysis.trend === "down"
                          ? "Baixa ↓"
                          : "Lateral →"
                    }
                    color={
                      analysis.trend === "up"
                        ? "text-emerald-400"
                        : analysis.trend === "down"
                          ? "text-red-400"
                          : "text-gray-400"
                    }
                  />
                  <IndicatorBadge
                    label="BB Sup"
                    value={analysis.bbUpper.toFixed(4)}
                    color="text-orange-400"
                  />
                  <IndicatorBadge
                    label="BB Inf"
                    value={analysis.bbLower.toFixed(4)}
                    color="text-blue-400"
                  />
                </div>
                <div className="mt-2 pt-2 border-t border-gray-800">
                  <p className="text-xs text-gray-500">Contexto das velas:</p>
                  <p className="text-xs text-gray-300 mt-0.5">{analysis.candleContext}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Signal Box ─────────────────────────────────────────────────────────────

function SignalBox({
  analysis,
  onExecute,
  executing,
  entryAmount,
  setEntryAmount,
  isDemo,
  setIsDemo,
  assetPayout,
}: {
  analysis: {
    direction: "call" | "put";
    strength: number;
    confidence: string;
    reasons: string[];
    blocks: string[];
    candleContext: string;
    analysts: {
      name: string;
      icon: string;
      direction: "call" | "put" | "hold";
      confidence: number;
      opinion: string;
    }[];
    signalReady: boolean;
  };
  onExecute: () => void;
  executing: boolean;
  entryAmount: string;
  setEntryAmount: (v: string) => void;
  isDemo: boolean;
  setIsDemo: (v: boolean) => void;
  assetPayout: number;
}) {
  const isCall = analysis.direction === "call";
  const ready = analysis.signalReady === true;
  const analysts = analysis.analysts ?? [];
  const agree = analysts.filter((a) => a.direction === analysis.direction).length;

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        ready
          ? isCall
            ? "bg-emerald-900/30 border-emerald-500/50 shadow-lg shadow-emerald-500/10"
            : "bg-red-900/30 border-red-500/50 shadow-lg shadow-red-500/10"
          : "bg-gray-900 border-gray-700"
      }`}
    >
      {/* Direction */}
      <div className="p-4 text-center">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">
          Sinal OTC
        </span>
        {ready ? (
          <>
            <div
              className={`mt-2 text-4xl font-black tracking-tight ${
                isCall ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {isCall ? "▲ CALL" : "▼ PUT"}
            </div>
            <div
              className={`mt-1 text-xs font-bold text-white px-3 py-1 rounded-full inline-block bg-gradient-to-r ${
                isCall ? "from-emerald-500 to-cyan-500" : "from-red-500 to-orange-500"
              }`}
            >
              ✅ CONSENSO {agree} de {analysts.length} análises
            </div>
          </>
        ) : (
          <div className="mt-2">
            <div className="text-2xl font-bold text-gray-500">⏳ AGUARDANDO CONSENSO</div>
            <div className="mt-1 text-xs text-gray-500">
              Ainda sem maioria: {agree} de {analysts.length} análises apontam{" "}
              {isCall ? "▲ CALL" : "▼ PUT"}
            </div>
          </div>
        )}
      </div>

      {/* Strength bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Acordo entre análises</span>
          <span
            className={
              analysis.strength >= 75
                ? "text-emerald-400"
                : analysis.strength >= 60
                  ? "text-yellow-400"
                  : "text-gray-500"
            }
          >
            {analysis.strength}%
          </span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              analysis.strength >= 75
                ? "bg-emerald-400"
                : analysis.strength >= 60
                  ? "bg-yellow-400"
                  : "bg-gray-600"
            }`}
            style={{ width: `${analysis.strength}%` }}
          />
        </div>
      </div>

      {/* Independent analyses */}
      <div className="px-4 pb-3">
        <p className="text-xs text-gray-500 mb-1.5">Análises independentes:</p>
        <div className="space-y-1">
          {analysts.map((a, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                a.direction === "hold"
                  ? "bg-gray-800/50 text-gray-500"
                  : a.direction === analysis.direction
                    ? isCall
                      ? "bg-emerald-900/40 text-emerald-300"
                      : "bg-red-900/40 text-red-300"
                    : "bg-gray-800/50 text-gray-400"
              }`}
            >
              <span className="text-base leading-none">{a.icon}</span>
              <span className="font-semibold whitespace-nowrap">{a.name}</span>
              <span className="flex-1 truncate">{a.opinion}</span>
              <span
                className={`font-bold ${
                  a.direction === "hold"
                    ? "text-gray-500"
                    : a.direction === "call"
                      ? "text-emerald-400"
                      : "text-red-400"
                }`}
              >
                {a.direction === "call" ? "▲" : a.direction === "put" ? "▼" : "⏸"}
              </span>
              <span className="text-gray-500 tabular-nums w-9 text-right">{a.confidence}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reasons */}
      {analysis.reasons.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-500 mb-1.5">Resumo:</p>
          <div className="space-y-1">
            {analysis.reasons.slice(0, 3).map((r, i) => (
              <p key={i} className="text-xs text-gray-400 flex items-start gap-1">
                <span className="text-emerald-500 mt-0.5">•</span>
                {r}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Entry controls */}
      <div className="px-4 pb-4 border-t border-gray-800/60 pt-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Valor de entrada ($)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={entryAmount}
              onChange={(e) => setEntryAmount(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Lucro estimado</label>
            <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-emerald-400">
              +${((parseFloat(entryAmount) || 0) * (assetPayout / 100)).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          {["1", "5", "10", "25", "50"].map((v) => (
            <button
              key={v}
              onClick={() => setEntryAmount(v)}
              className="flex-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 py-1 rounded transition-colors"
            >
              ${v}
            </button>
          ))}
        </div>

        {/* Demo/Real toggle */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500">Conta</span>
          <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setIsDemo(true)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                isDemo ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              DEMO
            </button>
            <button
              onClick={() => setIsDemo(false)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                !isDemo ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              REAL
            </button>
          </div>
        </div>

        {/* Execute button — only shows on majority consensus */}
        {ready ? (
          <button
            onClick={onExecute}
            disabled={executing}
            className={`w-full py-3 rounded-xl font-bold text-base transition-all ${
              executing
                ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                : isCall
                  ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/30 active:scale-95"
                  : "bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/30 active:scale-95"
            }`}
          >
            {executing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
                Verificando...
              </span>
            ) : (
              `${isCall ? "▲" : "▼"} ENTRAR ${isDemo ? "DEMO" : "REAL"}`
            )}
          </button>
        ) : (
          <div className="w-full py-3 rounded-xl text-center text-sm text-gray-600 bg-gray-800/50 border border-gray-800">
            {`Aguardando consenso (acordo ${analysis.strength}%)`}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Live tick helpers ───────────────────────────────────────────────────────

function applyTick(
  prev: { time: number; open: number; high: number; low: number; close: number }[],
  tick: { time: number; price: number },
) {
  if (!prev.length || !tick) return prev;
  const next = prev.slice();
  const last = next[next.length - 1];
  const tickMin = Math.floor(tick.time / 60) * 60;
  if (tickMin === last.time) {
    next[next.length - 1] = {
      ...last,
      close: tick.price,
      high: Math.max(last.high, tick.price),
      low: Math.min(last.low, tick.price),
    };
  } else if (tickMin > last.time) {
    // A new minute just opened — start its forming candle
    next.push({
      time: tickMin,
      open: tick.price,
      high: tick.price,
      low: tick.price,
      close: tick.price,
    });
    if (next.length > 160) next.shift();
  }
  return next;
}

// ─── Bulls vs Bears force gauge ──────────────────────────────────────────────

type Force = { bullPct: number; bearPct: number; winner: "bull" | "bear"; leader: number };

function computeForce(series: { open: number; close: number }[]): Force {
  if (!series.length) return { bullPct: 50, bearPct: 50, winner: "bull", leader: 0 };
  let bull = 0;
  let bear = 0;
  for (const c of series) {
    const move = c.close - c.open;
    if (move > 0) bull += move;
    else if (move < 0) bear += -move;
  }
  const total = bull + bear || 1;
  const bullPct = Math.round((bull / total) * 100);
  const bearPct = 100 - bullPct;
  return {
    bullPct,
    bearPct,
    winner: bullPct >= 50 ? "bull" : "bear",
    leader: Math.round((Math.abs(bull - bear) / total) * 100),
  };
}

// Verdict of the last CLOSED 1M candle: who won and with how much body force.
function closedCandleVerdict(
  candles: { open: number; high: number; low: number; close: number }[],
): { label: string; pct: number; color: string } | null {
  if (!candles.length) return null;
  const c = candles[candles.length - 1]; // forming
  const prev = candles.length >= 2 ? candles[candles.length - 2] : c; // last closed
  const range = prev.high - prev.low || 1;
  const body = Math.abs(prev.close - prev.open);
  const pct = Math.min(100, Math.round((body / range) * 100));
  if (prev.close >= prev.open) return { label: "Touros", pct, color: "#22c55e" };
  return { label: "Ursos", pct, color: "#ef4444" };
}

// Live tick momentum (microstructure metric): net buy/sell pressure from the
// last ~15 seconds of 1s candles — used to refine the next-candle probability.
function tickMomentum(series: { open: number; close: number }[]): number {
  if (series.length < 5) return 0;
  const recent = series.slice(-15);
  let net = 0;
  let vol = 0;
  for (const c of recent) {
    net += c.close - c.open;
    vol += Math.abs(c.close - c.open);
  }
  const denom = vol || 1;
  return Math.max(-1, Math.min(1, net / denom));
}

// ─── Candlestick Chart (SVG) ─────────────────────────────────────────────────

function CandlestickChart({
  candles,
  ema9,
  ema21,
  bbUpper,
  bbMid,
  bbLower,
  nextOpen,
  nextDir,
  nextProb,
}: {
  candles: { time: number; open: number; high: number; low: number; close: number }[];
  ema9?: number;
  ema21?: number;
  bbUpper?: number;
  bbMid?: number;
  bbLower?: number;
  nextOpen?: number;
  nextDir?: "call" | "put";
  nextProb?: number;
}) {
  if (!candles.length) return null;

  const W = 700;
  const H = 280;
  const PAD = { top: 10, right: 10, bottom: 20, left: 8 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const maxPrice = Math.max(...highs, bbUpper ?? -Infinity, nextOpen ?? -Infinity);
  const minPrice = Math.min(...lows, bbLower ?? Infinity, nextOpen ?? Infinity);
  const priceRange = maxPrice - minPrice || 1;

  const toY = (price: number) =>
    PAD.top + ((maxPrice - price) / priceRange) * chartH;

  const n = candles.length;
  const candleW = Math.max(2, Math.floor(chartW / n) - 1);
  const toX = (i: number) => PAD.left + (i / n) * chartW + candleW / 2;

  const bbPoints = candles
    .map((_, i) => {
      if (!bbUpper) return "";
      return `${toX(i).toFixed(1)},${toY(bbUpper).toFixed(1)}`;
    })
    .join(" ");

  const bbMidPoints = candles
    .map((_, i) => {
      if (!bbMid) return "";
      return `${toX(i).toFixed(1)},${toY(bbMid).toFixed(1)}`;
    })
    .join(" ");

  const bbLowerPoints = candles
    .map((_, i) => {
      if (!bbLower) return "";
      return `${toX(i).toFixed(1)},${toY(bbLower).toFixed(1)}`;
    })
    .join(" ");

  // Price labels
  const priceLabels = [maxPrice, (maxPrice + minPrice) / 2, minPrice];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-64"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Grid lines */}
      {priceLabels.map((p, i) => (
        <line
          key={i}
          x1={PAD.left}
          y1={toY(p)}
          x2={W - PAD.right}
          y2={toY(p)}
          stroke="#374151"
          strokeWidth="0.5"
          strokeDasharray="4,4"
        />
      ))}

      {/* Bollinger bands */}
      {bbUpper && bbLower && (
        <>
          <polygon
            points={`${bbPoints} ${bbLowerPoints.split(" ").reverse().join(" ")}`}
            fill="rgba(99,102,241,0.05)"
          />
          <polyline
            points={bbPoints}
            fill="none"
            stroke="rgba(251,146,60,0.5)"
            strokeWidth="1"
          />
          <polyline
            points={bbMidPoints}
            fill="none"
            stroke="rgba(148,163,184,0.4)"
            strokeWidth="1"
            strokeDasharray="3,3"
          />
          <polyline
            points={bbLowerPoints}
            fill="none"
            stroke="rgba(96,165,250,0.5)"
            strokeWidth="1"
          />
        </>
      )}

      {/* EMA lines */}
      {ema9 && (
        <line
          x1={PAD.left}
          y1={toY(ema9)}
          x2={W - PAD.right}
          y2={toY(ema9)}
          stroke="#22d3ee"
          strokeWidth="1"
          strokeDasharray="2,2"
          opacity="0.7"
        />
      )}
      {ema21 && (
        <line
          x1={PAD.left}
          y1={toY(ema21)}
          x2={W - PAD.right}
          y2={toY(ema21)}
          stroke="#facc15"
          strokeWidth="1"
          strokeDasharray="2,2"
          opacity="0.7"
        />
      )}

      {/* Candles */}
      {candles.map((c, i) => {
        const x = toX(i);
        const isUp = c.close >= c.open;
        const color = isUp ? "#22c55e" : "#ef4444";
        const bodyTop = toY(Math.max(c.open, c.close));
        const bodyBot = toY(Math.min(c.open, c.close));
        const bodyH = Math.max(1, bodyBot - bodyTop);
        const xLeft = x - candleW / 2;

        return (
          <g key={c.time}>
            {/* Wick */}
            <line
              x1={x}
              y1={toY(c.high)}
              x2={x}
              y2={toY(c.low)}
              stroke={color}
              strokeWidth="1"
            />
            {/* Body */}
            <rect
              x={xLeft}
              y={bodyTop}
              width={candleW}
              height={bodyH}
              fill={isUp ? "#22c55e" : "#ef4444"}
              opacity={0.9}
            />
          </g>
        );
      })}

      {/* Next candle preview — realistic size & color projected from the broker's
          real data (average body + amplitude of the recent 1M candles) and the
          algorithm's direction/strength, drawn at where the next candle will
          be born (the current forming close) */}
      {nextOpen != null && nextDir && (
        (() => {
          const ghostX = toX(n);
          const dirUp = nextDir === "call";
          const ghostColor = dirUp ? "#22c55e" : "#ef4444";
          const recent = candles.slice(-20);
          const avgRange =
            recent.reduce((s, c) => s + (c.high - c.low), 0) / recent.length ||
            priceRange * 0.6;
          const avgBody =
            recent.reduce((s, c) => s + Math.abs(c.close - c.open), 0) /
              recent.length ||
            avgRange * 0.6;
          // Project a real body (sized from the average) in the predicted
          // direction, with proportional wicks (from the average amplitude).
          const bodyProj = Math.min(avgBody, avgRange) * (dirUp ? 1 : -1);
          const projClose = nextOpen + bodyProj;
          const projHigh = Math.max(nextOpen, projClose) + avgRange * 0.25;
          const projLow = Math.min(nextOpen, projClose) - avgRange * 0.25;
          const gxLeft = ghostX - candleW / 2;
          const bodyTopY = toY(Math.max(nextOpen, projClose));
          const bodyBotY = toY(Math.min(nextOpen, projClose));
          return (
            <g key="ghost">
              <line
                x1={ghostX}
                y1={toY(projHigh)}
                x2={ghostX}
                y2={toY(projLow)}
                stroke={ghostColor}
                strokeWidth="1"
                strokeDasharray="3,3"
                opacity="0.7"
              />
              <rect
                x={gxLeft}
                y={bodyTopY}
                width={candleW}
                height={Math.max(1, bodyBotY - bodyTopY)}
                fill={ghostColor}
                strokeDasharray="3,3"
                stroke={ghostColor}
                opacity="0.55"
              />
              <text
                x={ghostX}
                y={H - 4}
                fill="#f59e0b"
                fontSize="7"
                fontWeight="bold"
                textAnchor="middle"
              >
                {dirUp ? "PRÓXIMA ▲" : "PRÓXIMA ▼"} {nextProb ?? 50}%
              </text>
            </g>
          );
        })()
      )}

      {/* Price labels */}
      {priceLabels.map((p, i) => (
        <text
          key={i}
          x={W - PAD.right - 2}
          y={toY(p) - 2}
          fill="#6b7280"
          fontSize="8"
          textAnchor="end"
        >
          {p.toFixed(4)}
        </text>
      ))}

      {/* Legend */}
      <g transform={`translate(${PAD.left + 4}, ${H - 6})`}>
        <rect x={0} y={-4} width={8} height={4} fill="#22d3ee" opacity={0.7} />
        <text x={10} y={0} fill="#22d3ee" fontSize="7" opacity={0.7}>
          EMA9
        </text>
        <rect x={40} y={-4} width={8} height={4} fill="#facc15" opacity={0.7} />
        <text x={50} y={0} fill="#facc15" fontSize="7" opacity={0.7}>
          EMA21
        </text>
        <rect x={80} y={-4} width={8} height={4} fill="#fb923c" opacity={0.7} />
        <text x={90} y={0} fill="#fb923c" fontSize="7" opacity={0.7}>
          BB Sup
        </text>
        <rect x={120} y={-4} width={8} height={4} fill="#60a5fa" opacity={0.7} />
        <text x={130} y={0} fill="#60a5fa" fontSize="7" opacity={0.7}>
          BB Inf
        </text>
        <rect x={0} y={8} width={8} height={4} fill="#f59e0b" opacity={0.8} />
        <text x={10} y={12} fill="#f59e0b" fontSize="7" opacity={0.9} fontWeight="bold">
          PRÓXIMA (probabilidade calculada)
        </text>
      </g>
    </svg>
  );
}

function IndicatorBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-gray-800 rounded-lg px-2 py-1.5">
      <p className="text-gray-500 text-xs leading-none">{label}</p>
      <p className={`font-semibold text-sm mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}