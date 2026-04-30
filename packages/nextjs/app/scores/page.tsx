"use client";

import type { NextPage } from "next";
import { Skeleton } from "~~/components/maeve/Skeleton";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import { MaeveTokenConfig, bpsToPercentNumber, formatBpsAsPercent, useMaeveTokens } from "~~/utils/maeve";

const Scores: NextPage = () => {
  const { byAddress } = useMaeveTokens();
  const { data, isLoading } = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "getAllTokenScores",
  });
  const tuple = data as readonly [readonly `0x${string}`[], readonly bigint[]] | undefined;
  const tokens = tuple?.[0] ?? [];
  const scores = tuple?.[1] ?? [];

  // Build display rows ordered by score descending (the "leaderboard" framing).
  const rows = tokens
    .map((address, i) => ({
      address: address.toLowerCase(),
      config: byAddress.get(address.toLowerCase()),
      scoreBps: scores[i] ?? 0n,
    }))
    .sort((a, b) => Number(b.scoreBps - a.scoreBps));

  const max = rows.length > 0 ? Number(rows[0].scoreBps) || 1 : 1;

  return (
    <div className="flex flex-col grow w-full max-w-7xl mx-auto px-6 py-12 gap-10">
      <header>
        <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-base-content/40 mb-2">scores</div>
        <h1 className="text-3xl font-light">Token Credit Scores.</h1>
        <p className="text-base-content/60 mt-2 text-sm max-w-2xl">
          A token&apos;s credit score is the average max LTV that lenders accept when this token is offered as
          collateral. The more lenders willing to back it — and the more aggressive their LTVs — the higher the score.
        </p>
      </header>

      <div className="maeve-card overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/40 border-b border-white/5">
          <div className="col-span-3">Token</div>
          <div className="col-span-5">Credit Score</div>
          <div className="col-span-2 text-right"># Lenders</div>
          <div className="col-span-2 text-right">Avg LTV</div>
        </div>
        {isLoading || rows.length === 0 ? (
          <div className="px-6 py-12 text-center font-mono text-xs text-base-content/40 uppercase tracking-[0.2em]">
            {isLoading ? <Skeleton width="8rem" /> : "no supported tokens yet"}
          </div>
        ) : (
          rows.map((r, i) => (
            <ScoreRow
              key={r.address}
              rank={i}
              isLast={i === rows.length - 1}
              config={r.config}
              fallbackAddress={r.address}
              scoreBps={r.scoreBps}
              max={max}
            />
          ))
        )}
      </div>

      <div className="maeve-card p-6">
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/50 mb-2">
          How it&apos;s computed
        </div>
        <p className="text-sm text-base-content/60 leading-relaxed">
          For each supported deposit pool, we look at the lenders who have explicitly opted in to accept this token as
          collateral, and average their max-LTV settings. SHORTCUT: the on-chain implementation is O(tokens ×
          depositors) and unweighted by deposit size — fine for the demo, replaced by a deposit-weighted index in
          production.
        </p>
      </div>
    </div>
  );
};

function ScoreRow({
  rank,
  isLast,
  config,
  fallbackAddress,
  scoreBps,
  max,
}: {
  rank: number;
  isLast: boolean;
  config?: MaeveTokenConfig;
  fallbackAddress: string;
  scoreBps: bigint;
  max: number;
}) {
  const symbol = config?.symbol ?? `${fallbackAddress.slice(0, 6)}…${fallbackAddress.slice(-4)}`;
  const name = config?.name ?? "Unknown token";

  // numLenders comes from getTokenCreditScore (the per-token call).
  // We fire it conditionally on having a resolved address — useScaffoldReadContract
  // disables itself when args contain undefined.
  const { data: tcs } = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "getTokenCreditScore",
    args: [fallbackAddress as `0x${string}`],
  });
  const tuple = tcs as readonly [bigint, bigint] | undefined;
  const numLenders = tuple?.[1];

  const widthPct = (Number(scoreBps) / max) * 100;

  return (
    <div
      className={`grid grid-cols-12 gap-4 px-6 py-5 items-center ${
        isLast ? "" : "border-b border-white/5"
      } hover:bg-white/[0.02] transition-colors`}
    >
      <div className="col-span-12 md:col-span-3 flex items-baseline gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-base-content/30 tabular-nums w-4">
          {String(rank + 1).padStart(2, "0")}
        </span>
        <div>
          <div className="font-mono text-base">{symbol}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-base-content/40 mt-0.5">{name}</div>
        </div>
      </div>
      <div className="col-span-12 md:col-span-5">
        <div className="flex items-center gap-3">
          <div className="font-mono tabular-nums text-base w-20">{formatBpsAsPercent(scoreBps)}</div>
          <div className="flex-1 h-2 bg-base-300 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${bpsToPercentNumber(scoreBps) > 0 ? widthPct : 0}%` }}
            />
          </div>
        </div>
      </div>
      <div className="col-span-6 md:col-span-2 text-right font-mono tabular-nums text-base-content/80">
        {numLenders !== undefined ? numLenders.toString() : <Skeleton width="1.5rem" />}
      </div>
      <div className="col-span-6 md:col-span-2 text-right font-mono tabular-nums text-primary">
        {formatBpsAsPercent(scoreBps)}
      </div>
    </div>
  );
}

export default Scores;
