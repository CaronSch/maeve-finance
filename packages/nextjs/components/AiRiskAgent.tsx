"use client";

// HACKATHON DEMO: Simulated AI analysis. Production version would use on-chain
// data feeds, historical volatility, and real-time liquidity depth.
import { useEffect, useMemo, useState } from "react";
import { CpuChipIcon } from "@heroicons/react/24/outline";
import { MaeveContext, useMaeveContext } from "~~/hooks/maeve";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import { formatToken } from "~~/utils/maeve";
import { notification } from "~~/utils/scaffold-eth";

type RiskTolerance = "conservative" | "moderate" | "aggressive";

type RecommendationSetting = {
  token: string;
  ltv: number;
  accept: boolean;
  reasoning: string;
};

type Recommendation = {
  depositToken: string;
  collateralSettings: RecommendationSetting[];
};

type AgentResponse = {
  recommendations: Recommendation[];
  riskSummary: string;
  source: "claude" | "stub";
};

const TOLERANCE_LABELS: Record<RiskTolerance, string> = {
  conservative: "Conservative",
  moderate: "Moderate",
  aggressive: "Aggressive",
};
const TOLERANCE_VALUES: RiskTolerance[] = ["conservative", "moderate", "aggressive"];

export function AiRiskAgent() {
  const ctx = useMaeveContext();
  const [risk, setRisk] = useState<RiskTolerance>("moderate");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const deposits = useUserDeposits(ctx);

  const onAnalyze = async () => {
    if (deposits.length === 0) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ai-risk-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deposits: deposits.map(d => ({ token: d.symbol, amount: formatToken(d.amount) })),
          riskTolerance: risk,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as AgentResponse;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "agent failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const onApplyAll = async () => {
    if (!result || !ctx.user) return;
    setApplying(true);
    let applied = 0;
    let failed = 0;
    try {
      for (const rec of result.recommendations) {
        const depositEntry = ctx.entries.find(e => e.config.symbol === rec.depositToken);
        if (!depositEntry?.address) continue;
        for (const setting of rec.collateralSettings) {
          const collEntry = ctx.entries.find(e => e.config.symbol === setting.token);
          if (!collEntry?.address) continue;
          // Cap LTV at 9000 bps (contract requirement); model returns whole percent.
          const ltvBps = BigInt(Math.min(Math.max(Math.round(setting.ltv * 100), 0), 9000));
          try {
            await ctx.poolWrite.writeContractAsync({
              functionName: "setCollateralPreference",
              args: [depositEntry.address, collEntry.address, ltvBps, setting.accept],
            });
            applied += 1;
          } catch {
            failed += 1;
          }
        }
      }
      if (applied > 0) notification.success(`Applied ${applied} recommendation${applied === 1 ? "" : "s"}.`);
      if (failed > 0) notification.warning(`${failed} recommendation${failed === 1 ? "" : "s"} failed.`);
    } finally {
      setApplying(false);
    }
  };

  const flatRecs = useMemo(
    () =>
      result?.recommendations.flatMap((rec, ri) =>
        rec.collateralSettings.map((s, si) => ({
          key: `${rec.depositToken}-${s.token}`,
          orderIdx: ri * 10 + si,
          depositToken: rec.depositToken,
          collateralToken: s.token,
          ltv: s.ltv,
          accept: s.accept,
          reasoning: s.reasoning,
        })),
      ) ?? [],
    [result],
  );

  return (
    <div className="maeve-card p-6">
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-center gap-3">
          <CpuChipIcon className="w-5 h-5 text-primary" />
          <h2 className="text-base font-light">AI Risk Agent</h2>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/40">
          {result?.source === "claude" ? "claude" : result?.source === "stub" ? "demo stub" : "ready"}
        </div>
      </div>
      <p className="text-sm text-base-content/60 mb-5">
        Recommends collateral preferences based on your risk tolerance and current deposits.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/40 mb-2">
            Your deposits
          </div>
          {deposits.length === 0 ? (
            <div className="font-mono text-xs text-base-content/40 uppercase tracking-[0.2em] py-2">
              {ctx.user ? "no deposits" : "wallet not connected"}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {deposits.map(d => (
                <div key={d.symbol} className="flex justify-between font-mono text-sm">
                  <span>{d.symbol}</span>
                  <span className="tabular-nums text-base-content/80">{formatToken(d.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/40 mb-2">
            Risk tolerance
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TOLERANCE_VALUES.map(t => (
              <button
                key={t}
                onClick={() => setRisk(t)}
                className={`px-3 py-2 text-[10px] font-mono uppercase tracking-[0.2em] rounded ${
                  risk === t ? "text-primary" : "text-base-content/60 hover:text-base-content"
                }`}
                style={{
                  border: `1px solid ${risk === t ? "rgba(45,212,168,0.4)" : "rgba(255,255,255,0.1)"}`,
                  transition: "border-color 200ms ease, color 200ms ease",
                }}
              >
                {TOLERANCE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        className="btn btn-primary w-full font-mono uppercase tracking-[0.2em] text-xs"
        disabled={!ctx.user || deposits.length === 0 || analyzing}
        onClick={onAnalyze}
      >
        {analyzing ? "Analyzing…" : "Analyze & Recommend"}
      </button>

      {error && <div className="mt-4 text-xs font-mono text-warning">{error}</div>}

      {result && (
        <div className="mt-6 flex flex-col gap-4">
          <div
            className="rounded-lg p-4 maeve-stagger"
            style={{
              border: "1px solid rgba(45,212,168,0.2)",
              background: "rgba(45,212,168,0.05)",
              animationDelay: "0ms",
            }}
          >
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary mb-2">Risk Summary</div>
            <p className="text-sm text-base-content/80 leading-relaxed">{result.riskSummary}</p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {flatRecs.map(r => (
              <RecommendationCard
                key={r.key}
                index={r.orderIdx + 1}
                depositToken={r.depositToken}
                collateralToken={r.collateralToken}
                ltv={r.ltv}
                accept={r.accept}
                reasoning={r.reasoning}
              />
            ))}
          </div>

          <button
            className="btn btn-primary w-full font-mono uppercase tracking-[0.2em] text-xs"
            disabled={!ctx.user || applying || ctx.poolWrite.isMining}
            onClick={onApplyAll}
          >
            {applying || ctx.poolWrite.isMining ? "Applying…" : "Apply All Recommendations"}
          </button>
        </div>
      )}
    </div>
  );
}

function RecommendationCard({
  index,
  depositToken,
  collateralToken,
  ltv,
  accept,
  reasoning,
}: {
  index: number;
  depositToken: string;
  collateralToken: string;
  ltv: number;
  accept: boolean;
  reasoning: string;
}) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const startDelay = index * 80;
    const startTimer = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i += 2;
        if (i >= reasoning.length) {
          setTyped(reasoning);
          clearInterval(interval);
        } else {
          setTyped(reasoning.slice(0, i));
        }
      }, 18);
      return () => clearInterval(interval);
    }, startDelay);
    return () => clearTimeout(startTimer);
  }, [reasoning, index]);

  return (
    <div
      className="rounded-lg p-4 maeve-stagger"
      style={{
        border: accept ? "1px solid rgba(45,212,168,0.25)" : "1px solid rgba(245,158,11,0.25)",
        background: "var(--color-base-200)",
        animationDelay: `${index * 80}ms`,
      }}
    >
      <div className="flex items-baseline justify-between mb-2">
        <div className="font-mono text-sm">
          <span className="text-base-content/90">{depositToken}</span>
          <span className="mx-2 text-base-content/30">←</span>
          <span className="text-base-content/90">{collateralToken}</span>
        </div>
        <div className={`font-mono tabular-nums text-base ${accept ? "text-primary" : "text-warning"}`}>
          {accept ? `${ltv}% LTV` : "REJECT"}
        </div>
      </div>
      <p className="text-xs text-base-content/60 leading-relaxed min-h-[2.5em]">{typed || "·"}</p>
    </div>
  );
}

function useUserDeposits(ctx: MaeveContext): { symbol: string; address: `0x${string}`; amount: bigint }[] {
  const usdc = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "deposits",
    args: [ctx.entries[0].address, ctx.user],
  });
  const weth = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "deposits",
    args: [ctx.entries[1].address, ctx.user],
  });
  const wbtc = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "deposits",
    args: [ctx.entries[2].address, ctx.user],
  });

  return useMemo(() => {
    const out: { symbol: string; address: `0x${string}`; amount: bigint }[] = [];
    const reads = [usdc.data, weth.data, wbtc.data];
    for (let i = 0; i < ctx.entries.length; i++) {
      const e = ctx.entries[i];
      const tuple = reads[i] as readonly [bigint, bigint] | undefined;
      const amt = tuple?.[0] ?? 0n;
      if (amt > 0n && e.address) out.push({ symbol: e.config.symbol, address: e.address, amount: amt });
    }
    return out;
  }, [ctx.entries, usdc.data, weth.data, wbtc.data]);
}
