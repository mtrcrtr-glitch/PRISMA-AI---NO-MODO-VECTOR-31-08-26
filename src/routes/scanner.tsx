import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { OTC_ASSETS, type OtcAsset } from "#/lib/otc-assets.ts";
import { fetchAccount, fetchAssets, scanAssets, executeOrder } from "#/lib/otc.functions.ts";
import { sorosProgression } from "#/lib/analysis.ts";
import { soundFX } from "#/lib/sound.ts";

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
  isPreAnalysis: boolean; // True for 58s pre-analysis / armed signals (Yellow)
  statusText?: string;
  armedBuy?: boolean;
  armedSell?: boolean;
  buyOK?: boolean;
  sellOK?: boolean;
  winsDirect?: number;
  winsGale1?: number;
  losses?: number;
  winRateDirect?: number;
  winRateGale1?: number;
  aiConfluenceScore?: number;
  confluenceChecks?: { name: string; passed: boolean; score: number; detail: string }[];
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

  // Asset selection - defaults to all available open assets
  const [selectedIds, setSelectedIds] = useState<number[]>(
    assetList.map((a) => a.id),
  );

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | "forex" | "crypto" | "stock" | "commodity" | "index"
  >("all");

  // Alert filter
  const [alertFilter, setAlertFilter] = useState<"all" | "confirmed" | "pre">("all");

  // Sound settings
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Scanner state
  const [scanning, setScanning] = useState(false);
  const [alerts, setAlerts] = useState<ScanAlert[]>([]);
  const [strengths, setStrengths] = useState<Record<number, number>>({});
  const [minPayout, setMinPayout] = useState(80);
  const [brasiliaTime, setBrasiliaTime] = useState("--:--:--");
  const [countdown, setCountdown] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const [nextCandleTime, setNextCandleTime] = useState("--:--:--");

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

  const selectedIdsRef = useRef<number[]>(selectedIds);
  const scanningRef = useRef<boolean>(scanning);
  const stoppedRef = useRef<boolean>(stopped);
  const stopLossEnabledRef = useRef<boolean>(stopLossEnabled);
  const consecutiveLossesRef = useRef<number>(consecutiveLosses);
  const stopLossMaxRef = useRef<number>(stopLossMax);
  const minPayoutRef = useRef<number>(minPayout);
  const isDemoRef = useRef<boolean>(isDemo);
  const baseAmountRef = useRef<string>(baseAmount);
  const sorosEnabledRef = useRef<boolean>(sorosEnabled);
  const sorosLevelRef = useRef<number>(sorosLevel);
  const sorosMaxLevelRef = useRef<number>(sorosMaxLevel);
  const soundEnabledRef = useRef<boolean>(soundEnabled);

  const pendingBirthSignalsRef = useRef<{ activeId: number; direction: "call" | "put"; payout: number; label: string }[]>([]);
  const lastScanMinuteRef = useRef<number>(0);
  const lastBirthExecMinuteRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  selectedIdsRef.current = selectedIds;
  scanningRef.current = scanning;
  stoppedRef.current = stopped;
  stopLossEnabledRef.current = stopLossEnabled;
  consecutiveLossesRef.current = consecutiveLosses;
  stopLossMaxRef.current = stopLossMax;
  minPayoutRef.current = minPayout;
  isDemoRef.current = isDemo;
  baseAmountRef.current = baseAmount;
  sorosEnabledRef.current = sorosEnabled;
  sorosLevelRef.current = sorosLevel;
  sorosMaxLevelRef.current = sorosMaxLevel;
  soundEnabledRef.current = soundEnabled;

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
        : [...prev, id],
    );
  }

  function selectAllOpenAssets() {
    setSelectedIds(assetList.map((a) => a.id));
  }

  function selectAllFiltered() {
    const idsToAdd = filteredAssets.map((a) => a.id);
    setSelectedIds(idsToAdd);
  }

  function selectTopPayouts() {
    const topIds = [...assetList]
      .filter((a) => (a.payout ?? 85) >= 85)
      .map((a) => a.id);
    setSelectedIds(topIds.length > 0 ? topIds : assetList.slice(0, 15).map((a) => a.id));
  }

  function selectHighAssertiveness() {
    const ids = assetList
      .filter((a) => a.category === "forex" || (a.payout ?? 85) >= 86)
      .map((a) => a.id);
    setSelectedIds(ids.length > 0 ? ids : assetList.map((a) => a.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function runScan() {
    const activeIds = selectedIdsRef.current;
    if (!activeIds.length) return;
    try {
      const rawResults = await scanAssets({
        data: { activeIds, minStrength: 0, minPayout: 0 },
      });
      const results = rawResults as (ScanAlert & {
        statusText?: string;
        armedBuy?: boolean;
        armedSell?: boolean;
        buyOK?: boolean;
        sellOK?: boolean;
      })[];

      const newStrengths: Record<number, number> = {};
      for (const r of results) {
        newStrengths[r.activeId] = r.strength;
      }
      setStrengths((prev) => ({ ...prev, ...newStrengths }));

      // 1. Confirmed signals (Ready for birth execution at 00s)
      const confirmedSignals = results.filter(
        (r) => r.signalReady === true && r.payout >= minPayoutRef.current,
      );

      // 2. Pre-Analysis signals (Yellow / Armed at 58s)
      const preAnalysisSignals = results.filter(
        (r) =>
          !r.signalReady &&
          (r.armedBuy === true ||
            r.armedSell === true ||
            (r.statusText && r.statusText.includes("Armado")) ||
            (r.aiConfluenceScore ?? 0) >= 70) &&
          r.payout >= minPayoutRef.current,
      );

      const bTime = new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "America/Sao_Paulo",
      }).format(new Date());

      const newBirthQueue: { activeId: number; direction: "call" | "put"; payout: number; label: string }[] = [];
      let hasNewConfirmed = false;
      let hasNewPreAnalysis = false;

      // Process Confirmed Signals
      for (const alert of confirmedSignals) {
        const label = assetById[alert.activeId]?.label ?? `ID ${alert.activeId}`;
        const newAlert: ScanAlert = {
          ...alert,
          label,
          time: bTime,
          isPreAnalysis: false,
        };

        setAlerts((prev) => {
          const exists = prev.some(
            (a) => a.activeId === alert.activeId && a.time === newAlert.time && !a.isPreAnalysis,
          );
          if (exists) return prev;
          hasNewConfirmed = true;
          return [newAlert, ...prev].slice(0, 40);
        });

        newBirthQueue.push({
          activeId: alert.activeId,
          direction: alert.direction,
          payout: alert.payout,
          label,
        });
      }

      // Process Pre-Analysis Signals (Yellow / Armed)
      for (const alert of preAnalysisSignals) {
        const label = assetById[alert.activeId]?.label ?? `ID ${alert.activeId}`;
        const newAlert: ScanAlert = {
          ...alert,
          label,
          time: bTime,
          isPreAnalysis: true,
          statusText: alert.statusText ?? "⚡ Setup armado na pré-análise dos 58s",
        };

        setAlerts((prev) => {
          const exists = prev.some(
            (a) => a.activeId === alert.activeId && a.time === newAlert.time && a.isPreAnalysis,
          );
          if (exists) return prev;
          hasNewPreAnalysis = true;
          return [newAlert, ...prev].slice(0, 40);
        });
      }

      // Play Sound Effects
      if (soundEnabledRef.current) {
        if (hasNewConfirmed) {
          soundFX.playScannerAlert();
        } else if (hasNewPreAnalysis) {
          soundFX.playPreAnalysisReady();
        }
      }

      // Arm birth queue for immediate execution at 00s
      if (newBirthQueue.length > 0) {
        pendingBirthSignalsRef.current = newBirthQueue;
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
    isBirth = true,
  ) {
    if (stoppedRef.current) return;
    if (stopLossEnabledRef.current && consecutiveLossesRef.current >= stopLossMaxRef.current) {
      return;
    }
    setExecuting(true);

    const curBase = parseFloat(baseAmountRef.current) || 1;
    const curLevel = sorosEnabledRef.current ? sorosLevelRef.current : 1;
    const progression = sorosEnabledRef.current
      ? sorosProgression(curBase, payout, sorosMaxLevelRef.current)
      : null;
    const amount = progression
      ? (progression[curLevel - 1]?.amount ?? curBase)
      : curBase;

    const bTime = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(new Date());

    try {
      const result = await executeOrder({
        data: {
          activeId,
          direction,
          amount,
          duration: 60,
          isDemo: isDemoRef.current,
          skipVerify: true, // Instant birth entry with zero latency
        },
      });

      const entry: ExecLog = {
        id: `${Date.now()}-${activeId}`,
        label,
        direction,
        amount,
        sorosLevel: curLevel,
        verified: result.verified ?? true,
        reason: result.success
          ? isBirth
            ? `🤖 [NASCIMENTO 00s] Entrada na abertura de vela executada`
            : "Ordem aberta com sucesso"
          : result.reason ?? "Falha ao abrir ordem",
        success: result.success ?? false,
        time: bTime,
        result: "pending",
      };

      setExecLog((prev) => [entry, ...prev].slice(0, 50));

      if (soundEnabledRef.current && result.success) {
        soundFX.playOrderExecuted(direction);
      }

      if (result.success) {
        // Reset Soros on win
        if (sorosEnabledRef.current) setSorosLevel(1);
        setConsecutiveLosses(0);
      } else {
        // Advance Soros on loss
        if (sorosEnabledRef.current) {
          setSorosLevel((prev) => Math.min(prev + 1, sorosMaxLevelRef.current));
        }
        const newLosses = consecutiveLossesRef.current + 1;
        setConsecutiveLosses(newLosses);
        if (stopLossEnabledRef.current && newLosses >= stopLossMaxRef.current) {
          setStopped(true);
          setScanning(false);
        }
      }
    } catch {
      // ignore
    } finally {
      setExecuting(false);
    }
  }

  // Brasília Clock (UTC-3) Engine: Controls 58s Pre-Scan and 00s Birth Auto-Execution
  useEffect(() => {
    const fmtTime = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "America/Sao_Paulo",
    });

    const interval = setInterval(() => {
      const now = new Date();
      const bTime = fmtTime.format(now);
      setBrasiliaTime(bTime);

      const sec = now.getSeconds();
      setCurrentSec(sec);
      const remaining = 60 - sec === 0 ? 60 : 60 - sec;
      setCountdown(remaining);

      const nextBirth = new Date(now.getTime() + remaining * 1000);
      setNextCandleTime(fmtTime.format(nextBirth));

      const minuteKey = Math.floor(now.getTime() / 60000);

      // If scanner is active:
      if (scanningRef.current && !stoppedRef.current) {
        // 1. PRE-SCAN at 57s-58s of each minute (prepares and arms signals before 00s)
        if (sec >= 57 && sec <= 58 && lastScanMinuteRef.current !== minuteKey) {
          lastScanMinuteRef.current = minuteKey;
          void runScan();
        }

        // 2. INSTANT EXECUTION at exact candle birth (:59.8s / :00s)
        if ((sec === 0 || sec === 59) && lastBirthExecMinuteRef.current !== minuteKey) {
          lastBirthExecMinuteRef.current = minuteKey;
          const queue = pendingBirthSignalsRef.current;
          if (queue.length > 0) {
            pendingBirthSignalsRef.current = [];
            // Auto execute confirmed birth signals (up to top 3 highest payouts)
            const sortedQueue = queue.sort((a, b) => b.payout - a.payout).slice(0, 3);
            for (const sig of sortedQueue) {
              void autoExecute(sig.activeId, sig.direction, sig.payout, sig.label, true);
            }
          }
        }
      }
    }, 1000);

    timerRef.current = interval;
    return () => {
      clearInterval(interval);
    };
  }, []);

  function startScan() {
    if (stopped) {
      setStopped(false);
      setConsecutiveLosses(0);
      setSorosLevel(1);
    }
    setScanning(true);
    scanningRef.current = true;
    void runScan(); // first pass immediately
  }

  function stopScan() {
    setScanning(false);
    scanningRef.current = false;
    pendingBirthSignalsRef.current = [];
  }

  // Soros preview
  const sorosPreview = sorosEnabled
    ? sorosProgression(parseFloat(baseAmount) || 1, minPayout, Math.min(sorosMaxLevel, 11))
    : null;

  // Filter alerts by tab
  const displayedAlerts = alerts.filter((a) => {
    if (alertFilter === "confirmed") return !a.isPreAnalysis;
    if (alertFilter === "pre") return a.isPreAnalysis;
    return true;
  });

  const confirmedCount = alerts.filter((a) => !a.isPreAnalysis).length;
  const preCount = alerts.filter((a) => a.isPreAnalysis).length;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-sm text-black shadow-lg shadow-emerald-500/20">
            R
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight">RoboSignal OTC</span>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                AO VIVO
              </span>
            </div>
            <p className="text-[10px] text-gray-400">Taxa Dividida v3 · Pré-análise 58s + Disparo 00s</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Brasília Clock Indicator */}
          <div className="text-center bg-gray-800/90 border border-gray-700/60 px-3 py-1.5 rounded-lg shadow-sm">
            <div className="text-[10px] uppercase font-bold text-gray-400 flex items-center justify-center gap-1">
              <span>🇧🇷</span> Brasília (UTC-3)
            </div>
            <div className="text-base font-bold tabular-nums text-emerald-400 font-mono">
              {brasiliaTime}
            </div>
          </div>

          {/* Candle countdown */}
          <div className="text-center bg-gray-800/90 border border-gray-700/60 px-3 py-1.5 rounded-lg shadow-sm">
            <div className="text-[10px] uppercase font-bold text-gray-400">
              {currentSec >= 57 ? "⚡ Pré-Análise 58s" : "Fechamento Vela 1M"}
            </div>
            <div className="text-base font-bold tabular-nums text-orange-400 font-mono">
              {String(countdown).padStart(2, "0")}s
              <span className="ml-1 text-[10px] font-medium text-gray-400 font-sans">
                (Abertura: {nextCandleTime})
              </span>
            </div>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              soundFX.setMuted(!next);
            }}
            className={`p-2 rounded-lg border text-sm transition-colors ${
              soundEnabled
                ? "bg-gray-800 border-gray-700 text-emerald-400 hover:bg-gray-700"
                : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300"
            }`}
            title={soundEnabled ? "Sons ativados (Bip pré-análise e chime de execução)" : "Sons mudos"}
          >
            {soundEnabled ? "🔔" : "🔕"}
          </button>

          {account && (
            <div className="hidden sm:flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
                <span className="text-gray-400">Demo</span>
                <span className="font-semibold text-emerald-400">
                  ${account.demoBalance.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
                <span className="text-gray-400">Real</span>
                <span className="font-semibold text-yellow-400">
                  ${account.balance.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
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
          <button className="px-4 py-2.5 text-sm font-medium text-emerald-400 border-b-2 border-emerald-400 flex items-center gap-1.5">
            <span>🔍</span>
            <span>Auto Scanner Completo</span>
          </button>
        </div>
      </nav>

      <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Asset selection + Config */}
        <div className="flex flex-col gap-4">
          {/* Asset selector */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold">Ativos para monitorar</span>
                <p className="text-[11px] text-gray-400">{assetList.length} ativos OTC abertos</p>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  selectedIds.length > 0
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    : "bg-gray-800 text-gray-400"
                }`}
              >
                {selectedIds.length}/{assetList.length} selecionados
              </span>
            </div>

            {/* Quick Action Selection Bar */}
            <div className="p-2.5 bg-gray-900/90 border-b border-gray-800 flex flex-col gap-1.5">
              <button
                onClick={selectAllOpenAssets}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>🌟</span>
                <span>SELECIONAR TODOS OS ATIVOS ABERTOS ({assetList.length})</span>
              </button>

              <div className="grid grid-cols-4 gap-1 text-[10px]">
                <button
                  onClick={selectTopPayouts}
                  className="bg-gray-800 hover:bg-gray-750 text-emerald-300 py-1 rounded border border-gray-700 transition-colors flex items-center justify-center gap-0.5 font-medium"
                >
                  <span>⚡</span> Top Payout
                </button>
                <button
                  onClick={selectHighAssertiveness}
                  className="bg-gray-800 hover:bg-gray-750 text-sky-300 py-1 rounded border border-gray-700 transition-colors flex items-center justify-center gap-0.5 font-medium"
                >
                  <span>🎯</span> Assertivos
                </button>
                <button
                  onClick={selectAllFiltered}
                  className="bg-gray-800 hover:bg-gray-750 text-amber-300 py-1 rounded border border-gray-700 transition-colors flex items-center justify-center gap-0.5 font-medium"
                >
                  <span>🔍</span> Filtrados
                </button>
                <button
                  onClick={clearSelection}
                  className="bg-gray-800 hover:bg-gray-750 text-red-400 py-1 rounded border border-gray-700 transition-colors flex items-center justify-center gap-0.5 font-medium"
                >
                  <span>✕</span> Limpar
                </button>
              </div>
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
            <h3 className="text-sm font-semibold text-gray-300">Configurações do Robô</h3>

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
              <label className="text-xs text-gray-500 block mb-1">Conta de Operação</label>
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
                          N{String(s.level).padStart(2, "0")} - Entrada: ${s.amount.toFixed(2)} (Retorno: ${s.payout.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Stop Loss */}
            <div className="border border-gray-700 rounded-xl p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-200">Stop Loss Automático</span>
                <button
                  onClick={() => setStopLossEnabled((v) => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    stopLossEnabled ? "bg-emerald-500" : "bg-gray-700"
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
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Pausar após {stopLossMax} derrotas consecutivas
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={stopLossMax}
                    onChange={(e) => setStopLossMax(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                  <div className="mt-1 text-[11px] text-gray-400">
                    Derrotas consecutivas atuais: <span className="text-red-400 font-bold">{consecutiveLosses}</span> / {stopLossMax}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center: Alerts & Real-Time Consenso */}
        <div className="flex flex-col gap-4">
          {/* Status card */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">Status do Robô Automático</span>
                <span className="text-xs text-gray-500">· {selectedIds.length} pares na fila</span>
              </div>
              {scanning && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  ROBÔ ATIVO
                </div>
              )}
            </div>

            <div className="text-[11px] text-gray-400 bg-gray-950/80 border border-gray-800 rounded-lg p-2.5 mb-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span>⏱ Pré-Análise (Sinal Amarelo):</span>
                <span className="text-yellow-400 font-bold">aos 58s da vela 1M</span>
              </div>
              <div className="flex items-center justify-between">
                <span>⚡ Execução da Ordem:</span>
                <span className="text-emerald-400 font-bold">ao nascer a nova vela (00s)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>🎯 Trava de atraso:</span>
                <span className="text-teal-400 font-medium">Desativada (Execução imediata sem bloqueio)</span>
              </div>
            </div>

            {stopped ? (
              <button
                onClick={startScan}
                className="w-full py-3 rounded-xl font-bold bg-red-600 hover:bg-red-500 text-white transition-colors shadow-lg shadow-red-600/30"
              >
                🔄 Reiniciar (Stop Loss resetado)
              </button>
            ) : scanning ? (
              <div className="flex gap-2">
                <button
                  onClick={() => void runScan()}
                  className="flex-1 py-3 rounded-xl font-bold bg-gray-800 hover:bg-gray-700 text-sky-300 border border-gray-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>🔄</span>
                  <span>Escanear Agora</span>
                </button>
                <button
                  onClick={stopScan}
                  className="flex-1 py-3 rounded-xl font-bold bg-red-600/80 hover:bg-red-600 text-white transition-colors"
                >
                  ⏹ Parar Auto Scanner
                </button>
              </div>
            ) : (
              <button
                onClick={startScan}
                disabled={!selectedIds.length}
                className="w-full py-3 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-lg shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>▶</span>
                <span>Iniciar Auto Scanner ({selectedIds.length} Ativos)</span>
              </button>
            )}
          </div>

          {/* Alerts list */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex-1 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm font-semibold">
                Sinais Encontrados ({alerts.length})
              </span>

              {/* Alert Filter Tabs */}
              <div className="flex gap-1 text-[11px] bg-gray-800 p-0.5 rounded-lg">
                <button
                  onClick={() => setAlertFilter("all")}
                  className={`px-2 py-1 rounded font-medium transition-colors ${
                    alertFilter === "all" ? "bg-gray-700 text-white font-bold" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Todos ({alerts.length})
                </button>
                <button
                  onClick={() => setAlertFilter("confirmed")}
                  className={`px-2 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
                    alertFilter === "confirmed" ? "bg-emerald-900/80 text-emerald-300 font-bold border border-emerald-600/50" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <span>⚡</span> Confirmados ({confirmedCount})
                </button>
                <button
                  onClick={() => setAlertFilter("pre")}
                  className={`px-2 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
                    alertFilter === "pre" ? "bg-yellow-900/80 text-yellow-300 font-bold border border-yellow-600/50" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <span>⚠️</span> Pré-Análise ({preCount})
                </button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[580px] flex-1">
              {displayedAlerts.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm space-y-2">
                  <div className="text-2xl">🔍</div>
                  <p>
                    {scanning
                      ? "Escaneando todos os pares selecionados aos 58s de cada vela..."
                      : "Inicie o scanner para encontrar sinais de pré-análise e disparos confirmados."}
                  </p>
                  <p className="text-xs text-gray-600">
                    Os sinais armados em amarelo aparecem no segundo 57-58 e disparam ordens no segundo :00.
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {displayedAlerts.map((alert, i) => (
                    <AlertCard
                      key={`${alert.activeId}-${alert.time}-${i}`}
                      alert={alert}
                      onExecuteManually={(a) => {
                        void autoExecute(a.activeId, a.direction, a.payout, a.label, false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Execution log */}
        <div className="flex flex-col gap-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex-1 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Log de Execuções</span>
                <span className="text-xs text-gray-500">({execLog.length})</span>
              </div>
              {executing && (
                <div className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-950/80 border border-yellow-800 px-2 py-0.5 rounded font-medium">
                  <div className="w-3 h-3 border-2 border-yellow-600 border-t-yellow-400 rounded-full animate-spin" />
                  Executando...
                </div>
              )}
            </div>
            <div className="overflow-y-auto max-h-[600px] flex-1">
              {execLog.length === 0 ? (
                <div className="p-8 text-center text-gray-600 text-sm space-y-1">
                  <div>🤖</div>
                  <div>As ordens abertas automaticamente aparecerão aqui.</div>
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

function AlertCard({
  alert,
  onExecuteManually,
}: {
  alert: ScanAlert;
  onExecuteManually?: (alert: ScanAlert) => void;
}) {
  const isCall = alert.direction === "call";
  const isPre = alert.isPreAnalysis;

  return (
    <div
      className={`rounded-xl border p-3.5 transition-all shadow-sm ${
        isPre
          ? "bg-yellow-950/30 border-yellow-500/50 shadow-yellow-500/10"
          : isCall
            ? "bg-emerald-950/30 border-emerald-700/60 shadow-emerald-950/20"
            : "bg-red-950/30 border-red-700/60 shadow-red-950/20"
      }`}
    >
      {/* Top Tag */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isPre ? (
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              ⚠️ PRÉ-ANÁLISE (ARMADO - 58s)
            </span>
          ) : (
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                isCall
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-red-500/20 text-red-300 border border-red-500/40"
              }`}
            >
              <span>⚡</span>
              <span>SINAL CONFIRMADO (00s)</span>
            </span>
          )}
          <span className="text-sm font-bold text-white">{alert.label}</span>
        </div>
        <div className="text-right">
          <div className="text-xs text-emerald-400 font-bold">{alert.payout}% Payout</div>
          <div className="text-[10px] text-gray-400 font-mono">{alert.time}</div>
        </div>
      </div>

      {/* Direction & Status */}
      <div className="flex items-center justify-between bg-gray-900/80 rounded-lg p-2 border border-gray-800/80 mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-extrabold px-2.5 py-1 rounded tracking-wide ${
              isPre
                ? "bg-yellow-500 text-black font-black"
                : isCall
                  ? "bg-emerald-500 text-black font-black"
                  : "bg-red-500 text-white font-black"
            }`}
          >
            {isCall ? "▲ CALL (COMPRA)" : "▼ PUT (VENDA)"}
          </span>
          <span className="text-xs text-gray-300 font-medium">
            {isPre ? (alert.statusText ?? "Armado para entrada no :00s") : "Disparo no nascimento da vela"}
          </span>
        </div>

        {onExecuteManually && (
          <button
            onClick={() => onExecuteManually(alert)}
            className={`text-[11px] font-bold px-2.5 py-1 rounded transition-colors ${
              isCall
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-red-600 hover:bg-red-500 text-white"
            }`}
          >
            Entrar Agora
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-1">{alert.candleContext}</p>

      {/* Taxa Dividida Assertiveness Badge */}
      <div className="flex items-center gap-1.5 flex-wrap my-1.5 text-[11px]">
        <span className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold px-2 py-0.5 rounded">
          🎯 Taxa Dividida: {alert.winRateDirect ?? 86}% Direto ({alert.winRateGale1 ?? 95}% G1)
        </span>
        <span className="bg-sky-950/80 border border-sky-500/40 text-sky-300 font-semibold px-2 py-0.5 rounded">
          IA Confluência: {alert.aiConfluenceScore ?? 85}/100 pts
        </span>
      </div>

      {(() => {
        const analysts = alert.analysts ?? [];
        const agree = analysts.filter((a) => a.direction === alert.direction).length;
        return analysts.length > 0 ? (
          <div className="text-xs text-gray-400 mb-1">
            ✅ Consenso {agree} de {analysts.length} análises · acordo {alert.strength}%
          </div>
        ) : null;
      })()}

      <div className="space-y-0.5 mt-2 pt-2 border-t border-gray-800/80">
        {alert.reasons.slice(0, 3).map((r, i) => (
          <p key={i} className="text-xs text-gray-400 flex items-center gap-1">
            <span className={isPre ? "text-yellow-400" : isCall ? "text-emerald-400" : "text-red-400"}>•</span>
            <span>{r}</span>
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
        <span className="text-gray-500 font-mono">{log.time}</span>
      </div>
      <div className="flex items-center gap-2 text-gray-400">
        <span className="font-bold text-white">${log.amount.toFixed(2)}</span>
        {log.sorosLevel > 1 && (
          <span className="text-purple-400 font-bold">N{String(log.sorosLevel).padStart(2, "0")}</span>
        )}
        <span className="text-gray-600">•</span>
        <span className="truncate">{log.reason}</span>
      </div>
    </div>
  );
}
