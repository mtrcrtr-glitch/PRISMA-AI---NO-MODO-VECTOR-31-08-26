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
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();

  const currentAssetId =
    searchParams && "asset" in (searchParams as Record<string, unknown>)
      ? Number((searchParams as Record<string, string>).asset)
      : assets[0]?.id ?? 76;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | "forex" | "crypto" | "stock" | "commodity" | "index"
  >("all");

  const connOk = conn?.ok === true;
  const connAccount = connOk
    ? (conn as { ok: true; account: { name: string; balance: number; demoBalance: number; currency: string } }).account
    : null;
  const displayAccount = connAccount ?? account;

  // Filter assets
  const filteredAssets = assets.filter((a) => {
    const matchesCat = selectedCategory === "all" || a.category === selectedCategory;
    if (!matchesCat) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      a.symbol.toLowerCase().includes(q) ||
      a.label.toLowerCase().includes(q) ||
      String(a.id).includes(q)
    );
  });

  const categories: { id: "all" | "forex" | "crypto" | "stock" | "commodity" | "index"; label: string; icon: string }[] = [
    { id: "all", label: "Todos", icon: "🌐" },
    { id: "forex", label: "Forex", icon: "💱" },
    { id: "crypto", label: "Cripto", icon: "🪙" },
    { id: "stock", label: "Ações", icon: "📈" },
    { id: "commodity", label: "Commodities", icon: "🛢️" },
    { id: "index", label: "Índices", icon: "📊" },
  ];

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
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-sm text-black shadow-lg shadow-emerald-500/20">
            R
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight">RoboSignal OTC</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${connOk ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
                {connOk ? "AO VIVO · CORRETORA" : "OFFLINE"}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 hidden sm:block">
              {assets.length} Ativos OTC em Tempo Real · Taxa Dividida v3
            </p>
          </div>
        </div>
        {displayAccount && (
          <div className="flex items-center gap-3 text-sm">
            <div className="hidden sm:flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700/50">
              <span className="text-gray-400 text-xs">Demo</span>
              <span className="font-semibold text-emerald-400">
                ${displayAccount.demoBalance.toFixed(2)}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700/50">
              <span className="text-gray-400 text-xs">Real</span>
              <span className="font-semibold text-yellow-400">
                ${displayAccount.balance.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700/50">
              <div className={`w-2 h-2 rounded-full ${connOk ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
              <span className="text-gray-300 text-xs font-medium">{displayAccount.name.split(" ")[0]}</span>
            </div>
          </div>
        )}
      </header>

      {/* Nav */}
      <nav className="border-b border-gray-800 bg-gray-900/60 px-4">
        <div className="flex gap-1">
          <button
            onClick={() => void navigate({ to: "/" })}
            className="px-4 py-2.5 text-sm font-medium text-emerald-400 border-b-2 border-emerald-400 flex items-center gap-1.5"
          >
            <span>📊 OTC ao Vivo</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-800">
              {assets.length}
            </span>
          </button>
          <button
            onClick={() => void navigate({ to: "/scanner" })}
            className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white border-b-2 border-transparent hover:border-gray-600 transition-colors flex items-center gap-1.5"
          >
            <span>🔍 Auto Scanner</span>
          </button>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar - asset list with search and categories */}
        <aside className="w-64 lg:w-72 border-r border-gray-800 bg-gray-900/40 flex flex-col flex-shrink-0">
          {/* Search bar */}
          <div className="p-3 border-b border-gray-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                Catálogo OTC
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">
                {filteredAssets.length}/{assets.length}
              </span>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar par, ação, crypto..."
                className="w-full bg-gray-800/90 border border-gray-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
              <span className="absolute left-2.5 top-2 text-xs text-gray-500">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1.5 text-xs text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category pills */}
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
              {categories.map((c) => {
                const count =
                  c.id === "all"
                    ? assets.length
                    : assets.filter((a) => a.category === c.id).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-2 py-1 rounded-md font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                      selectedCategory === c.id
                        ? "bg-emerald-500 text-black font-bold shadow"
                        : "bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-750"
                    }`}
                  >
                    <span>{c.icon}</span>
                    <span>{c.label}</span>
                    <span className="opacity-75 text-[10px]">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* List of assets */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-800/40">
            {filteredAssets.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500">
                Nenhum ativo encontrado para &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredAssets.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  selected={asset.id === currentAssetId}
                />
              ))
            )}
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

function AssetRow({
  asset,
  selected,
}: {
  asset: OtcAsset & { payout: number };
  selected: boolean;
}) {
  const navigate = useNavigate();

  const catIcon =
    asset.category === "crypto"
      ? "🪙"
      : asset.category === "stock"
        ? "📈"
        : asset.category === "commodity"
          ? "🛢️"
          : asset.category === "index"
            ? "📊"
            : "💱";

  return (
    <button
      onClick={() =>
        void navigate({
          to: "/",
          search: (prev: Record<string, string>) => ({ ...prev, asset: String(asset.id) }),
        })
      }
      className={`w-full text-left px-3 py-2 transition-all flex items-center justify-between group ${
        selected
          ? "bg-emerald-950/70 border-l-4 border-emerald-400 pl-2"
          : "hover:bg-gray-800/60 border-l-4 border-transparent"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs opacity-75">{catIcon}</span>
        <div className="min-w-0">
          <p
            className={`text-xs font-semibold truncate leading-tight ${
              selected ? "text-emerald-300" : "text-gray-200 group-hover:text-white"
            }`}
          >
            {asset.label.replace(" OTC", "")}
          </p>
          <p className="text-[10px] text-gray-500 flex items-center gap-1">
            <span>OTC</span>
            <span>·</span>
            <span className="font-mono">ID {asset.id}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span
          className={`text-[11px] px-1.5 py-0.5 rounded font-bold ${
            asset.payout >= 88
              ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50"
              : "bg-gray-800 text-gray-300"
          }`}
        >
          {asset.payout}%
        </span>
      </div>
    </button>
  );
}

// ─── Main OTC Panel ─────────────────────────────────────────────────────────

function OtcPanel({ assets }: { assets: (OtcAsset & { payout: number })[]; live?: boolean }) {
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

  // Countdown to next candle (Brasília time, UTC-3 synchronized with broker clock)
  const brokerOffsetRef = useRef<number>(0);

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
    countRef.current = setInterval(() => {
      const now = Math.floor((Date.now() + brokerOffsetRef.current) / 1000);
      setCountdown(60 - (now % 60));
      const next = now + (60 - (now % 60));
      setNextTime(fmt.format(new Date(next * 1000)));
    }, 1000);
    return () => {
      if (countRef.current) clearInterval(countRef.current);
    };
  }, []);

  // Live Realtime Stream (SSE): Receives broker candle ticks every 500ms with zero delay
  // and syncs exact server timestamp directly with the broker.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!asset) return;
    let disposed = false;
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(`/api/stream?activeId=${asset.id}`);

      eventSource.addEventListener("timeSync", (ev) => {
        if (disposed) return;
        try {
          const data = JSON.parse(ev.data) as { serverTime: number; clientTimestamp: number };
          if (data && data.serverTime) {
            brokerOffsetRef.current = data.serverTime - Date.now();
          }
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener("candle", (ev) => {
        if (disposed) return;
        try {
          const c = JSON.parse(ev.data) as {
            time: number;
            open: number;
            high: number;
            low: number;
            close: number;
            activeId: number;
          };
          if (!c || c.activeId !== asset.id) return;

          setLivePrice(c.close);
          setCandles((prev) => {
            if (!prev.length) {
              return [c];
            }
            const copy = prev.slice();
            const last = copy[copy.length - 1];
            if (c.time === last.time) {
              copy[copy.length - 1] = {
                time: c.time,
                open: c.open,
                high: Math.max(last.high, c.high),
                low: Math.min(last.low, c.low),
                close: c.close,
              };
              tickSeriesRef.current = copy.slice(-60);
              setForce(computeForce(copy.slice(-30)));
              return copy;
            } else if (c.time > last.time) {
              copy.push(c);
              if (copy.length > 160) copy.shift();
              tickSeriesRef.current = copy.slice(-60);
              setForce(computeForce(copy.slice(-30)));
              return copy;
            }
            return prev;
          });
        } catch {
          // ignore parse error
        }
      });

      eventSource.onerror = () => {
        // SSE error handled automatically by browser reconnect
      };
    } catch {
      // Fallback handled by intervals
    }

    return () => {
      disposed = true;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [asset?.id]);

  // Periodic refresh of the complete 150 REAL broker candles for accuracy
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
    const iv = setInterval(() => void refresh(), 10000);
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
                    emaMacro={analysis?.emaMacro}
                    emaInter={analysis?.emaInter}
                    ema9={analysis?.ema9}
                    ema21={analysis?.ema21}
                    gatilhoTaxa50={analysis?.gatilhoTaxa50 ?? undefined}
                    bbUpper={analysis?.bbUpper}
                    bbMid={analysis?.bbMid}
                    bbLower={analysis?.bbLower}
                    nextOpen={livePrice ?? analysis?.lastPrice}
                    markers={analysis?.markers}
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
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-400 font-bold uppercase">JOSE TRADER · TAXA DIVIDIDA v3</p>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold">
                    TAXA3
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <IndicatorBadge
                    label="Macro EMA 100"
                    value={analysis.emaMacro ? analysis.emaMacro.toFixed(4) : "—"}
                    color={analysis.lastPrice >= analysis.emaMacro ? "text-emerald-400" : "text-red-400"}
                  />
                  <IndicatorBadge
                    label="Inter EMA 50"
                    value={analysis.emaInter ? analysis.emaInter.toFixed(4) : "—"}
                    color={analysis.lastPrice >= analysis.emaInter ? "text-emerald-400" : "text-red-400"}
                  />
                  <IndicatorBadge
                    label="Buffer 1 (SMA1-34)"
                    value={analysis.buffer1 !== undefined ? analysis.buffer1.toFixed(5) : "—"}
                    color={analysis.buffer1 >= analysis.buffer2 ? "text-emerald-400" : "text-red-400"}
                  />
                  <IndicatorBadge
                    label="Buffer 2 (WMA 5)"
                    value={analysis.buffer2 !== undefined ? analysis.buffer2.toFixed(5) : "—"}
                    color="text-yellow-400"
                  />
                  <IndicatorBadge
                    label="Taxa 50% Gatilho"
                    value={analysis.gatilhoTaxa50 ? analysis.gatilhoTaxa50.toFixed(4) : "Aguardando"}
                    color="text-purple-400"
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
                </div>
                <div className="mt-2 pt-2 border-t border-gray-800">
                  <p className="text-xs text-gray-500">Status do Setup:</p>
                  <p className="text-xs text-emerald-300 font-medium mt-0.5">{analysis.statusText ?? analysis.candleContext}</p>
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
    statusText?: string;
    buyOK?: boolean;
    sellOK?: boolean;
    armedBuy?: boolean;
    armedSell?: boolean;
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
  const armed = analysis.armedBuy || analysis.armedSell;
  const analysts = analysis.analysts ?? [];

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        ready
          ? isCall
            ? "bg-emerald-950/40 border-emerald-500/60 shadow-xl shadow-emerald-500/20"
            : "bg-red-950/40 border-red-500/60 shadow-xl shadow-red-500/20"
          : armed
            ? "bg-yellow-950/30 border-yellow-500/40 shadow-lg shadow-yellow-500/10"
            : "bg-gray-900 border-gray-700"
      }`}
    >
      {/* Strategy Header */}
      <div className="bg-gray-900/90 border-b border-gray-800 px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
          <span>🎯</span> JOSE TRADER · TAXA DIVIDIDA v3
        </span>
        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold">
          {ready ? "ENTRADA CONFIRMADA" : armed ? "SETUP ARMADO" : "MONITORANDO"}
        </span>
      </div>

      {/* Direction & Main Trigger */}
      <div className="p-4 text-center">
        {ready ? (
          <>
            <div className="text-xs uppercase font-bold tracking-widest text-emerald-400">
              ⚡ SINAL DE ENTRADA NA MESMA VELA
            </div>
            <div
              className={`mt-1 text-3xl sm:text-4xl font-black tracking-tight ${
                isCall ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {isCall ? "▲ JOSE COMPRAR" : "▼ JOSE VENDER"}
            </div>
            <div
              className={`mt-2 text-xs font-bold text-white px-3 py-1 rounded-full inline-block bg-gradient-to-r ${
                isCall ? "from-emerald-600 to-teal-500" : "from-red-600 to-orange-500"
              }`}
            >
              🎯 TAXA DIVIDIDA 50% + MICRO MOTOR OK
            </div>
          </>
        ) : armed ? (
          <div className="py-2">
            <div className="text-xs uppercase font-bold text-yellow-400">
              🟡 SETUP ARMADO (PADRÃO 5 VELAS DETECTADO)
            </div>
            <div className="mt-1 text-2xl font-black text-yellow-300">
              {analysis.armedBuy ? "▲ AGUARDANDO DISPARO COMPRA" : "▼ AGUARDANDO DISPARO VENDA"}
            </div>
            <div className="mt-1 text-xs text-gray-400">
              Aguardando confirmação do micro motor (SMA1 cruzando WMA5)
            </div>
          </div>
        ) : (
          <div className="py-2">
            <div className="text-xl font-bold text-gray-400">⏳ MONITORANDO PADRÃO</div>
            <div className="mt-1 text-xs text-gray-500">
              Aguardando rompimento &gt;50% e devolução na taxa de retração
            </div>
          </div>
        )}
      </div>

      {/* Strength bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Força do Setup</span>
          <span
            className={
              analysis.strength >= 80
                ? "text-emerald-400 font-bold"
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
              analysis.strength >= 80
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
        <p className="text-xs text-gray-500 mb-1.5 font-semibold">Módulos da Estratégia:</p>
        <div className="space-y-1">
          {analysts.map((a, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                a.direction === "hold"
                  ? "bg-gray-800/50 text-gray-500"
                  : a.direction === analysis.direction
                    ? isCall
                      ? "bg-emerald-900/40 text-emerald-300 border border-emerald-800/40"
                      : "bg-red-900/40 text-red-300 border border-red-800/40"
                    : "bg-gray-800/50 text-gray-400"
              }`}
            >
              <span className="text-base leading-none">{a.icon}</span>
              <span className="font-semibold whitespace-nowrap">{a.name}</span>
              <span className="flex-1 truncate text-gray-300">{a.opinion}</span>
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
          <p className="text-xs text-gray-500 mb-1.5">Regras do Setup:</p>
          <div className="space-y-1">
            {analysis.reasons.slice(0, 4).map((r, i) => (
              <p key={i} className="text-xs text-gray-400 flex items-start gap-1">
                <span className="text-emerald-500 mt-0.5 font-bold">•</span>
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
            <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-emerald-400 font-bold">
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
          <span className="text-xs text-gray-500">Conta de Operação</span>
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

        {/* Execute button */}
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
                Executando na Broker...
              </span>
            ) : (
              `${isCall ? "▲ ENTRAR COMPRA" : "▼ ENTRAR VENDA"} (${isDemo ? "DEMO" : "REAL"})`
            )}
          </button>
        ) : (
          <div className="w-full py-3 rounded-xl text-center text-sm text-gray-500 bg-gray-800/50 border border-gray-800">
            {armed
              ? "⚡ Setup armado! Aguardando gatilho no nascimento da vela"
              : "⏳ Aguardando confirmação do setup Taxa Dividida..."}
          </div>
        )}
      </div>
    </div>
  );
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
  emaMacro,
  emaInter,
  gatilhoTaxa50,
  nextOpen,
  markers,
  nextDir,
  nextProb,
}: {
  candles: { time: number; open: number; high: number; low: number; close: number }[];
  emaMacro?: number;
  emaInter?: number;
  gatilhoTaxa50?: number;
  nextOpen?: number;
  markers?: { time: number; type: "buy" | "sell" | "armed_buy" | "armed_sell"; price: number; label: string }[];
  nextDir?: "call" | "put";
  nextProb?: number;
}) {
  if (!candles.length) return null;

  const W = 700;
  const H = 280;
  const PAD = { top: 16, right: 12, bottom: 24, left: 8 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const maxPrice = Math.max(
    ...highs,
    emaMacro ?? -Infinity,
    emaInter ?? -Infinity,
    gatilhoTaxa50 ?? -Infinity,
    nextOpen ?? -Infinity,
  );
  const minPrice = Math.min(
    ...lows,
    emaMacro ?? Infinity,
    emaInter ?? Infinity,
    gatilhoTaxa50 ?? Infinity,
    nextOpen ?? Infinity,
  );
  const priceRange = maxPrice - minPrice || 1;

  const toY = (price: number) =>
    PAD.top + ((maxPrice - price) / priceRange) * chartH;

  const n = candles.length;
  const candleW = Math.max(3, Math.floor(chartW / n) - 1);
  const toX = (i: number) => PAD.left + (i / n) * chartW + candleW / 2;

  // Price labels
  const priceLabels = [maxPrice, (maxPrice + minPrice) / 2, minPrice];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-64 select-none"
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

      {/* EMA Macro 100 Line */}
      {emaMacro && (
        <line
          x1={PAD.left}
          y1={toY(emaMacro)}
          x2={W - PAD.right}
          y2={toY(emaMacro)}
          stroke="#06b6d4"
          strokeWidth="1.5"
          strokeDasharray="4,2"
          opacity="0.8"
        />
      )}

      {/* EMA Inter 50 Line */}
      {emaInter && (
        <line
          x1={PAD.left}
          y1={toY(emaInter)}
          x2={W - PAD.right}
          y2={toY(emaInter)}
          stroke="#eab308"
          strokeWidth="1.5"
          opacity="0.8"
        />
      )}

      {/* Gatilho 50% Line */}
      {gatilhoTaxa50 && (
        <line
          x1={PAD.left}
          y1={toY(gatilhoTaxa50)}
          x2={W - PAD.right}
          y2={toY(gatilhoTaxa50)}
          stroke="#a855f7"
          strokeWidth="1.5"
          strokeDasharray="3,3"
          opacity="0.9"
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

        // Match markers for this candle
        const marker = markers?.find(
          (m) => Math.abs(m.time - c.time) < 60 || (i === candles.length - 1 && m.type),
        );

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
              fill={color}
              opacity={0.9}
            />

            {/* Custom Strategy Markers on Candles */}
            {marker && marker.type === "buy" && (
              <g transform={`translate(${x}, ${toY(c.low) + 12})`}>
                <polygon points="0,-8 6,4 -6,4" fill="#22c55e" />
                <text
                  x="0"
                  y="12"
                  fill="#22c55e"
                  fontSize="7"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  JOSE COMPRA
                </text>
              </g>
            )}

            {marker && marker.type === "sell" && (
              <g transform={`translate(${x}, ${toY(c.high) - 12})`}>
                <polygon points="0,8 6,-4 -6,-4" fill="#ef4444" />
                <text
                  x="0"
                  y="-8"
                  fill="#ef4444"
                  fontSize="7"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  JOSE VENDA
                </text>
              </g>
            )}

            {marker && (marker.type === "armed_buy" || marker.type === "armed_sell") && (
              <circle
                cx={x}
                cy={marker.type === "armed_buy" ? toY(c.low) + 8 : toY(c.high) - 8}
                r="3"
                fill="#facc15"
              />
            )}
          </g>
        );
      })}

      {/* Next candle preview */}
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
        <line x1={0} y1={-2} x2={10} y2={-2} stroke="#06b6d4" strokeWidth="2" strokeDasharray="3,1" />
        <text x={14} y={1} fill="#06b6d4" fontSize="7" fontWeight="bold">
          EMA Macro (100)
        </text>
        <line x1={80} y1={-2} x2={90} y2={-2} stroke="#eab308" strokeWidth="2" />
        <text x={94} y={1} fill="#eab308" fontSize="7" fontWeight="bold">
          EMA Inter (50)
        </text>
        <line x1={155} y1={-2} x2={165} y2={-2} stroke="#a855f7" strokeWidth="2" strokeDasharray="2,2" />
        <text x={169} y={1} fill="#a855f7" fontSize="7" fontWeight="bold">
          Taxa 50%
        </text>
        <polygon points="220,-4 224,2 216,2" fill="#22c55e" />
        <text x={228} y={1} fill="#22c55e" fontSize="7" fontWeight="bold">
          Sinal TAXA3
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