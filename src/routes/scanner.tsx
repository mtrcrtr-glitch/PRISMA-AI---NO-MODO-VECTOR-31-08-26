import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { OTC_ASSETS, type OtcAsset } from "#/lib/otc-assets.ts";
import { fetchAccount, fetchAssets, scanAssets, executeOrder } from "#/lib/otc.functions.ts";
import { sorosProgression } from "#/lib/analysis.ts";

export const Route = createFileRoute("/scanner")({
  loader: async () => {
    const [accountRes, assetsRes] = await Promise.allSettled([
      fetchAccount(),
      fetchAssets(),
    ]);
    return {
      account: accountRes.status === "fulfilled" ? accountRes.value : null,
      assets: assetsRes.status === "fulfilled" && assetsRes.value.length > 0 ? assetsRes.value : OTC_ASSETS,
    };
  },
  component: ScannerPage,
});

interface ScanAlert {
  activeId: number;
  label: string;
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
  time: string;
}

interface ExecLog {
  id: string;
  label: string;
  direction: "call" | "put";
  amount: number;
  sorosLevel: number;
  verified: boolean;
  reason: string;
  success: boolean;
  time: string;
  result?: "win" | "loss" | "pending";
}

function ScannerPage() {
  const { account, assets } = Route.useLoaderData();
  const assetList: (OtcAsset & { payout?: number })[] =
    assets && assets.length > 0 ? assets : OTC_ASSETS;

  // Asset selection
  const [selectedIds, setSelectedIds] = useState<number[]>(
    assetList.slice(0, 8).map((a) => a.id),
  );

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | "forex" | "crypto" | "stock" | "commodity" | "index"
  >("all");

  // Scanner state
  const [scanning, setScanning] = useState(false);
  const [alerts, setAlerts] = useState<ScanAlert[]>([]);
  const [strengths, setStrengths] = useState<Record<number, number>>({});
  const [minPayout, setMinPayout] = useState(80);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Execution settings
  const [baseAmount, setBaseAmount] = useState("1");
  const [isDemo, setIsDemo] = useState(true);

  // Soros
  const [sorosEnabled, setSorosEnabled] = useState(false);
  const [sorosMaxLevel, setSorosMaxLevel] = useState(4);
  const [sorosLevel, setSorosLevel] = useState(1);

  // Stop Loss
  const [stopLossEnabled, setStopLossEnabled] = useState(false);
  const [stopLossMax, setStopLossMax] = useState(3);
  const [consecutiveLosses, setConsecutiveLosses] = useState(0);
  const [stopped, setStopped] = useState(false);

  // Execution log
  const [execLog, setExecLog] = useState<ExecLog[]>([]);
  const [executing, setExecuting] = useState(false);

  const assetById = Object.fromEntries(assetList.map((a) => [a.id, a]));

  const filteredAssets = assetList.filter((a) => {
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

  function toggleAsset(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 30
          ? [...prev, id]
          : prev,
    );
  }

  function selectAllFiltered() {
    const idsToAdd = filteredAssets.slice(0, 30).map((a) => a.id);
    setSelectedIds(idsToAdd);
  }

  function selectTopPayouts() {
    const topIds = [...assetList]
      .sort((a, b) => (b.payout ?? 85) - (a.payout ?? 85))
      .slice(0, 15)
      .map((a) => a.id);
    setSelectedIds(topIds);
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function runScan() {
    if (!selectedIds.length) return;
    try {
      const rawResults = await scanAssets({
        data: { activeIds: selectedIds, minStrength: 0, minPayout: 0 },
      });
      const results = rawResults as ScanAlert[];
      const newStrengths: Record<number, number> = {};
      for (const r of results) {
        newStrengths[r.activeId] = r.strength;
      }
      setStrengths((prev) => ({ ...prev, ...newStrengths }));

      const goodAlerts = results.filter(
        (r) => r.signalReady === true && r.payout >= minPayout,
      );

      for (const alert of goodAlerts) {
        const label = assetById[alert.activeId]?.label ?? `ID ${alert.activeId}`;
        const newAlert: ScanAlert = {
          ...alert,
          label,
          time: new Date().toLocaleTimeString("pt-BR"),
        };
        setAlerts((prev) => {
          const exists = prev.some(
            (a) => a.activeId === alert.activeId && a.time === newAlert.time,
          );
          if (exists) return prev;
          return [newAlert, ...prev].slice(0, 20);
        });

        // Auto-execute if not stopped
        if (!stopped && !(stopLossEnabled && consecutiveLosses >= stopLossMax)) {
          void autoExecute(alert.activeId, alert.direction, alert.payout, label);
        }
      }
    } catch {
      // ignore scan errors
    }
  }

  async function autoExecute(
    activeId: number,
    direction: "call" | "put",
    payout: number,
    label: string,
  ) {
    if (stopped) return;
    setExecuting(true);

    const progression = sorosEnabled
      ? sorosProgression(parseFloat(baseAmount) || 1, payout, sorosMaxLevel)
      : null;
    const level = sorosEnabled ? sorosLevel : 1;
    const amount = progression
      ? (progression[level - 1]?.amount ?? (parseFloat(baseAmount) || 1))
      : parseFloat(baseAmount) || 1;

    try {
      const result = await executeOrder({
        data: { activeId, direction, amount, duration: 60, isDemo, skipVerify: false },
      });

      const entry: ExecLog = {
        id: `${Date.now()}-${activeId}`,
        label,
        direction,
        amount,
        sorosLevel: level,
        verified: result.verified ?? false,
        reason: result.reason ?? "",
        success: result.success ?? false,
        time: new Date().toLocaleTimeString("pt-BR"),
        result: "pending",
      };

      setExecLog((prev) => [entry, ...prev].slice(0, 50));

      if (result.success) {
        // Reset Soros on win
        if (sorosEnabled) setSorosLevel(1);
        setConsecutiveLosses(0);
      } else {
        // Advance Soros on loss
        if (sorosEnabled) {
          setSorosLevel((prev) => Math.min(prev + 1, sorosMaxLevel));
        }
        const newLosses = consecutiveLosses + 1;
        setConsecutiveLosses(newLosses);
        if (stopLossEnabled && newLosses >= stopLossMax) {
          setStopped(true);
          setScanning(false);
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }
    } catch {
      // ignore
    } finally {
      setExecuting(false);
    }
  }

  const scanActiveRef = useRef(false);

  // Scanner runs its analysis exactly at the birth of each 1M candle (:00),
  // synchronized to the broker's minute boundary — not every few seconds.
  function scheduleScan() {
    const now = Math.floor(Date.now() / 1000);
    const msToBirth = (60 - (now % 60)) * 1000 + 200;
    intervalRef.current = setTimeout(() => {
      if (!scanActiveRef.current) return;
      void runScan();
      scheduleScan();
    }, msToBirth);
  }

  function startScan() {
    if (stopped) {
      setStopped(false);
      setConsecutiveLosses(0);
      setSorosLevel(1);
    }
    setScanning(true);
    scanActiveRef.current = true;
    void runScan(); // first pass immediately
    scheduleScan();
  }

  function stopScan() {
    setScanning(false);
    scanActiveRef.current = false;
    if (intervalRef.current) clearTimeout(intervalRef.current);
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, []);

  // Soros preview
  const sorosPreview = sorosEnabled
    ? sorosProgression(parseFloat(baseAmount) || 1, minPayout, Math.min(sorosMaxLevel, 11))
    : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-sm text-black">
            R
          </div>
          <span className="font-bold text-lg tracking-tight">RoboSignal OTC</span>
          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
            AO VIVO
          </span>
        </div>
        {account && (
          <div className="flex items-center gap-3 text-sm">
            <div className="hidden sm:flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-lg">
              <span className="text-gray-400">Demo</span>
              <span className="font-semibold text-emerald-400">
                ${account.demoBalance.toFixed(2)}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-lg">
              <span className="text-gray-400">Real</span>
              <span className="font-semibold text-yellow-400">
                ${account.balance.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </header>

      {/* Nav */}
      <nav className="border-b border-gray-800 bg-gray-900/60 px-4">
        <div className="flex gap-1">
          <Link
            to="/"
            className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white border-b-2 border-transparent hover:border-gray-600 transition-colors"
          >
            📊 OTC ao Vivo
          </Link>
          <button className="px-4 py-2.5 text-sm font-medium text-emerald-400 border-b-2 border-emerald-400">
            🔍 Auto Scanner
          </button>
        </div>
      </nav>

      <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Asset selection + Config */}
        <div className="flex flex-col gap-4">
          {/* Asset selector */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold">Ativos para monitorar</span>
                <p className="text-[11px] text-gray-500">{assetList.length} ativos OTC disponíveis</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${selectedIds.length > 0 ? "bg-emerald-950 text-emerald-300 border border-emerald-800" : "bg-gray-800 text-gray-400"}`}>
                {selectedIds.length}/30 ativos
              </span>
            </div>

            {/* Search & Category filter */}
            <div className="p-3 border-b border-gray-800 space-y-2 bg-gray-900/60">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar por moeda, ação..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
                <span className="absolute left-2 top-2 text-xs text-gray-500">🔍</span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1.5 text-xs text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Categories */}
              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none text-[10px]">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-2 py-0.5 rounded font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                      selectedCategory === c.id
                        ? "bg-emerald-500 text-black font-bold"
                        : "bg-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    <span>{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>

              {/* Quick actions */}
              <div className="flex gap-1 pt-1 text-[10px]">
                <button
                  onClick={selectAllFiltered}
                  className="flex-1 bg-gray-800 hover:bg-gray-750 text-gray-300 py-1 rounded border border-gray-700 transition-colors"
                >
                  + Selecionar exibidos ({Math.min(filteredAssets.length, 30)})
                </button>
                <button
                  onClick={selectTopPayouts}
                  className="flex-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 py-1 rounded border border-emerald-800/60 transition-colors"
                >
                  ⚡ Top Payouts
                </button>
                <button
                  onClick={clearSelection}
                  className="px-2 bg-gray-800 hover:bg-gray-750 text-gray-400 hover:text-red-400 py-1 rounded border border-gray-700 transition-colors"
                  title="Limpar"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-2 max-h-72 overflow-y-auto divide-y divide-gray-800/30">
              {filteredAssets.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500">
                  Nenhum ativo encontrado.
                </div>
              ) : (
                filteredAssets.map((asset) => {
                  const selected = selectedIds.includes(asset.id);
                  const strength = strengths[asset.id];
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
                      key={asset.id}
                      onClick={() => toggleAsset(asset.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg mb-0.5 flex items-center justify-between transition-colors ${
                        selected
                          ? "bg-emerald-950/60 border border-emerald-700/60 text-white"
                          : "hover:bg-gray-800/60 border border-transparent text-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                            selected
                              ? "bg-emerald-500 border-emerald-500"
                              : "border-gray-600 bg-gray-800"
                          }`}
                        >
                          {selected && <span className="text-black text-[9px] font-bold">✓</span>}
                        </div>
                        <span className="text-xs opacity-75">{catIcon}</span>
                        <div className="min-w-0">
                          <span className="text-xs font-medium truncate block">
                            {asset.label.replace(" OTC", "")}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            ID {asset.id}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {asset.payout && (
                          <span className="text-[10px] font-mono text-gray-400 bg-gray-800 px-1 py-0.2 rounded">
                            {asset.payout}%
                          </span>
                        )}
                        {strength !== undefined && (
                          <span
                            className={`text-xs font-bold ${
                              strength >= 75
                                ? "text-emerald-400"
                                : strength >= 60
                                  ? "text-yellow-400"
                                  : "text-gray-500"
                            }`}
                          >
                            {strength}%
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Config */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-gray-300">Configurações</h3>

            {/* Amount */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Valor base de entrada ($)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={baseAmount}
                onChange={(e) => setBaseAmount(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              <div className="flex gap-1 mt-1.5">
                {["1", "5", "10", "25"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setBaseAmount(v)}
                    className="flex-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 py-1 rounded transition-colors"
                  >
                    ${v}
                  </button>
                ))}
              </div>
            </div>

            {/* Min payout */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Payout mínimo para executar: {minPayout}%
              </label>
              <input
                type="range"
                min="60"
                max="95"
                step="5"
                value={minPayout}
                onChange={(e) => setMinPayout(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            {/* Demo / Real */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Conta</label>
              <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
                <button
                  onClick={() => setIsDemo(true)}
                  className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                    isDemo ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  DEMO
                </button>
                <button
                  onClick={() => setIsDemo(false)}
                  className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                    !isDemo ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  REAL
                </button>
              </div>
            </div>

            {/* Soros */}
            <div className="border border-gray-700 rounded-xl p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-200">Nível Soros</span>
                <button
                  onClick={() => setSorosEnabled((v) => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    sorosEnabled ? "bg-emerald-500" : "bg-gray-700"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      sorosEnabled ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {sorosEnabled && (
                <>
                  <div className="mb-3">
                    <label className="text-xs text-gray-500 mb-1 block">
                      Nível máximo: N{String(sorosMaxLevel).padStart(2, "0")}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="11"
                      step="1"
                      value={sorosMaxLevel}
                      onChange={(e) => setSorosMaxLevel(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="text-xs text-gray-500 mb-1 block">
                      Nível atual: N{String(sorosLevel).padStart(2, "0")}
                    </label>
                    <select
                      value={sorosLevel}
                      onChange={(e) => setSorosLevel(Number(e.target.value))}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                    >
                      {sorosPreview?.map((s) => (
                        <option key={s.level} value={s.level}>
                          N{String(s.level).padStart(2, "0")} — ${s.amount.toFixed(2)} (lucro +${s.profit.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                  {sorosPreview && (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {sorosPreview.map((s) => (
                        <div
                          key={s.level}
                          className={`flex items-center justify-between text-xs px-2 py-1 rounded ${
                            s.level === sorosLevel
                              ? "bg-emerald-900/40 border border-emerald-700/50"
                              : "bg-gray-800/50"
                          }`}
                        >
                          <span className="text-gray-400">N{String(s.level).padStart(2, "0")}</span>
                          <span className="text-gray-300">${s.amount.toFixed(2)}</span>
                          <span className="text-emerald-400">+${s.profit.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Stop Loss */}
            <div className="border border-gray-700 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-200">Stop Loss</span>
                <button
                  onClick={() => setStopLossEnabled((v) => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    stopLossEnabled ? "bg-red-500" : "bg-gray-700"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      stopLossEnabled ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              {stopLossEnabled && (
                <>
                  <div className="mb-2">
                    <label className="text-xs text-gray-500 mb-1 block">
                      Máximo de perdas seguidas: {stopLossMax}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={stopLossMax}
                      onChange={(e) => setStopLossMax(Number(e.target.value))}
                      className="w-full accent-red-500"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Perdas consecutivas:</span>
                    <span
                      className={`font-bold ${
                        consecutiveLosses >= stopLossMax ? "text-red-400" : "text-orange-400"
                      }`}
                    >
                      {consecutiveLosses}/{stopLossMax}
                    </span>
                  </div>
                </>
              )}
              {stopped && (
                <div className="mt-2 text-xs text-center text-red-400 bg-red-900/20 rounded-lg py-2 font-semibold">
                  🛑 STOP LOSS ATIVADO
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Middle: Alerts */}
        <div className="flex flex-col gap-4">
          {/* Scanner control */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">Scanner ao Vivo</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {scanning
                    ? `Monitorando ${selectedIds.length} ativos...`
                    : "Scanner parado"}
                </p>
              </div>
              {scanning && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  ATIVO
                </div>
              )}
            </div>
            {stopped ? (
              <button
                onClick={startScan}
                className="w-full py-3 rounded-xl font-bold bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                🔄 Reiniciar (Stop Loss resetado)
              </button>
            ) : scanning ? (
              <button
                onClick={stopScan}
                className="w-full py-3 rounded-xl font-bold bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              >
                ⏹ Parar Scanner
              </button>
            ) : (
              <button
                onClick={startScan}
                disabled={!selectedIds.length}
                className="w-full py-3 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ▶ Iniciar Scanner
              </button>
            )}
          </div>

          {/* Alerts list */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex-1">
            <div className="px-4 py-3 border-b border-gray-800">
              <span className="text-sm font-semibold">
                Alertas por consenso ({alerts.length})
              </span>
            </div>
            <div className="overflow-y-auto max-h-96">
              {alerts.length === 0 ? (
                <div className="p-8 text-center text-gray-600 text-sm">
                  {scanning
                    ? "Aguardando consenso das análises..."
                    : "Inicie o scanner para ver alertas"}
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {alerts.map((alert, i) => (
                    <AlertCard key={i} alert={alert} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Execution log */}
        <div className="flex flex-col gap-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex-1">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <span className="text-sm font-semibold">Log de Execuções</span>
              {executing && (
                <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                  <div className="w-3 h-3 border border-yellow-600 border-t-yellow-400 rounded-full animate-spin" />
                  Executando...
                </div>
              )}
            </div>
            <div className="overflow-y-auto max-h-[600px]">
              {execLog.length === 0 ? (
                <div className="p-8 text-center text-gray-600 text-sm">
                  As execuções aparecerão aqui
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {execLog.map((log) => (
                    <LogCard key={log.id} log={log} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: ScanAlert }) {
  const isCall = alert.direction === "call";
  return (
    <div
      className={`rounded-xl border p-3 ${
        isCall
          ? "bg-emerald-900/20 border-emerald-800/40"
          : "bg-red-900/20 border-red-800/40"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-bold px-2 py-0.5 rounded ${
              isCall
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-red-500/20 text-red-300"
            }`}
          >
            {isCall ? "▲ CALL" : "▼ PUT"}
          </span>
          <span className="text-sm font-medium">{alert.label}</span>
        </div>
        <div className="text-right">
          <div className="text-xs text-emerald-400 font-bold">{alert.payout}%</div>
          <div className="text-xs text-gray-500">{alert.time}</div>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-1">{alert.candleContext}</p>
      {(() => {
        const analysts = alert.analysts ?? [];
        const agree = analysts.filter((a) => a.direction === alert.direction).length;
        return analysts.length > 0 ? (
          <div className="text-xs text-gray-500 mb-1">
            ✅ Consenso {agree} de {analysts.length} análises · acordo {alert.strength}%
          </div>
        ) : null;
      })()}
      <div className="space-y-0.5">
        {alert.reasons.slice(0, 3).map((r, i) => (
          <p key={i} className="text-xs text-gray-400">
            • {r}
          </p>
        ))}
      </div>
    </div>
  );
}

function LogCard({ log }: { log: ExecLog }) {
  return (
    <div
      className={`rounded-xl border p-3 text-xs ${
        log.success
          ? "bg-emerald-900/10 border-emerald-800/30"
          : "bg-red-900/10 border-red-800/30"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span>{log.success ? "✅" : "❌"}</span>
          <span className="font-semibold">{log.label}</span>
          <span
            className={`px-1.5 py-0.5 rounded font-bold ${
              log.direction === "call"
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {log.direction.toUpperCase()}
          </span>
        </div>
        <span className="text-gray-500">{log.time}</span>
      </div>
      <div className="flex items-center gap-2 text-gray-400">
        <span>${log.amount.toFixed(2)}</span>
        {log.sorosLevel > 1 && (
          <span className="text-purple-400">N{String(log.sorosLevel).padStart(2, "0")}</span>
        )}
        <span className="text-gray-600">•</span>
        <span className="truncate">{log.reason}</span>
      </div>
    </div>
  );
}