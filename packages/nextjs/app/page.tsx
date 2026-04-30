"use client";

import Link from "next/link";
import type { NextPage } from "next";

// Placeholder data — wired to contract reads in a later step.
const placeholderTokens = [
  { symbol: "mUSDC", name: "Mock USDC", scoreBps: 7200, lenders: 14 },
  { symbol: "mWETH", name: "Mock WETH", scoreBps: 8400, lenders: 22 },
  { symbol: "mWBTC", name: "Mock WBTC", scoreBps: 6500, lenders: 9 },
];

const Dashboard: NextPage = () => {
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
        {[
          { label: "Total Deposited", value: "—" },
          { label: "Total Borrowed", value: "—" },
          { label: "Active Loans", value: "—" },
        ].map(stat => (
          <div key={stat.label} className="maeve-card p-5">
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/40">{stat.label}</div>
            <div className="font-mono text-3xl mt-3 tabular-nums text-base-content/90">{stat.value}</div>
          </div>
        ))}
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
          {placeholderTokens.map(t => (
            <div key={t.symbol} className="maeve-card maeve-card-hover p-5">
              <div className="flex items-baseline justify-between">
                <div className="font-mono text-base text-base-content/90">{t.symbol}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-base-content/40">{t.name}</div>
              </div>
              <div className="mt-5">
                <div className="font-mono text-3xl tabular-nums">
                  {(t.scoreBps / 100).toFixed(2)}
                  <span className="text-base text-base-content/40 ml-1">%</span>
                </div>
                <div className="text-xs text-base-content/40 mt-1">average accepted LTV</div>
              </div>
              <div className="mt-4 h-1 bg-base-300 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${t.scoreBps / 100}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-base-content/50">
                <span>{t.lenders} accepting lenders</span>
                <span className="text-primary/80">●</span>
              </div>
            </div>
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

export default Dashboard;
