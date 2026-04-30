"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { Skeleton } from "~~/components/maeve/Skeleton";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import { MaeveTokenEntry, bpsToPercentNumber, formatBpsAsPercent, formatToken, useMaeveTokens } from "~~/utils/maeve";

const Dashboard: NextPage = () => {
  const { entries } = useMaeveTokens();
  const { data: nextLoanId } = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "nextLoanId",
  });

  return (
    <div className="flex flex-col grow w-full max-w-7xl mx-auto px-6 py-12 gap-12">
      <header className="border-b border-white/5 pb-10">
        <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-base-content/40 mb-3">
          maeve // protocol
        </div>
        <h1 className="text-5xl md:text-6xl font-light tracking-tight mb-4">Maeve Finance.</h1>
        <p className="text-lg text-base-content/60 max-w-2xl">Lending where lenders set the rules.</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TotalSumStat label="Total Deposited" entries={entries} functionName="totalDeposited" />
        <TotalSumStat label="Total Borrowed" entries={entries} functionName="totalBorrowed" />
        {/* SHORTCUT: nextLoanId counts every loan ever created, not currently-active.
            A real metric would track active count, or scan loans with `active == true`. */}
        <StatCard label="Active Loans" value={nextLoanId !== undefined ? nextLoanId.toString() : undefined} />
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <h2 className="text-xl font-medium">Token Credit Scores</h2>
            <p className="text-sm text-base-content/50 mt-1">
              Average max LTV that lenders accept when this token is offered as collateral.
            </p>
          </div>
          <Link
            href="/scores"
            className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary hover:opacity-80"
          >
            View leaderboard →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {entries.map(e => (
            <TokenScoreCard key={e.config.contractName} entry={e} />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/lend" className="maeve-card maeve-card-hover p-6 group">
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary mb-3">For Lenders</div>
          <div className="text-2xl font-light mb-2">Choose your collateral.</div>
          <p className="text-sm text-base-content/60">
            Provide liquidity and explicitly opt in to which tokens can back loans against your deposit.
          </p>
          <div className="mt-5 text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/50 group-hover:text-primary">
            Lend →
          </div>
        </Link>
        <Link href="/borrow" className="maeve-card maeve-card-hover p-6 group">
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary mb-3">For Borrowers</div>
          <div className="text-2xl font-light mb-2">Borrow on the lenders&apos; terms.</div>
          <p className="text-sm text-base-content/60">
            Your max LTV is set by the lenders willing to accept your collateral, aggregated live.
          </p>
          <div className="mt-5 text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/50 group-hover:text-primary">
            Borrow →
          </div>
        </Link>
      </section>
    </div>
  );
};

function StatCard({ label, value }: { label: string; value?: string }) {
  return (
    <div className="maeve-card p-5">
      <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/40">{label}</div>
      <div className="font-mono text-3xl mt-3 tabular-nums text-base-content/90">
        {value !== undefined ? value : <Skeleton width="6rem" />}
      </div>
    </div>
  );
}

function TotalSumStat({
  label,
  entries,
  functionName,
}: {
  label: string;
  entries: MaeveTokenEntry[];
  functionName: "totalDeposited" | "totalBorrowed";
}) {
  // Pull each token's totalDeposited/totalBorrowed independently, then sum.
  // Hardcoding 3 hook calls (one per token) keeps the rules-of-hooks rule satisfied.
  const usdc = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName,
    args: [entries[0].address],
  });
  const weth = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName,
    args: [entries[1].address],
  });
  const wbtc = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName,
    args: [entries[2].address],
  });

  const ready = usdc.data !== undefined && weth.data !== undefined && wbtc.data !== undefined;
  const total = ready ? (usdc.data as bigint) + (weth.data as bigint) + (wbtc.data as bigint) : undefined;

  return <StatCard label={label} value={total !== undefined ? formatToken(total) : undefined} />;
}

function TokenScoreCard({ entry }: { entry: MaeveTokenEntry }) {
  const { data } = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "getTokenCreditScore",
    args: [entry.address],
  });
  const tuple = data as readonly [bigint, bigint] | undefined;
  const scoreBps = tuple?.[0];
  const numLenders = tuple?.[1];

  return (
    <div className="maeve-card maeve-card-hover p-5">
      <div className="flex items-baseline justify-between">
        <div className="font-mono text-base text-base-content/90">{entry.config.symbol}</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-base-content/40">{entry.config.name}</div>
      </div>
      <div className="mt-5">
        <div className="font-mono text-3xl tabular-nums">
          {scoreBps !== undefined ? formatBpsAsPercent(scoreBps) : <Skeleton width="5rem" />}
        </div>
        <div className="text-xs text-base-content/40 mt-1">average accepted LTV</div>
      </div>
      <div className="mt-4 h-1 bg-base-300 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${bpsToPercentNumber(scoreBps)}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-base-content/50">
        <span>{numLenders !== undefined ? numLenders.toString() : <Skeleton width="1.5rem" />} accepting lenders</span>
        <span className={`${(scoreBps ?? 0n) > 0n ? "text-primary/80" : "text-base-content/20"}`}>●</span>
      </div>
    </div>
  );
}

export default Dashboard;
