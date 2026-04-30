"use client";

import type { NextPage } from "next";

const rows = [
  { symbol: "mWETH", name: "Mock WETH", scoreBps: 8400, lenders: 22, avgLtvBps: 8400 },
  { symbol: "mUSDC", name: "Mock USDC", scoreBps: 7200, lenders: 14, avgLtvBps: 7200 },
  { symbol: "mWBTC", name: "Mock WBTC", scoreBps: 6500, lenders: 9, avgLtvBps: 6500 },
];

const Scores: NextPage = () => {
  const max = Math.max(...rows.map(r => r.scoreBps), 1);

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
        {rows.map((r, i) => (
          <div
            key={r.symbol}
            className={`grid grid-cols-12 gap-4 px-6 py-5 items-center ${
              i < rows.length - 1 ? "border-b border-white/5" : ""
            } hover:bg-white/[0.02] transition-colors`}
          >
            <div className="col-span-12 md:col-span-3 flex items-baseline gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-base-content/30 tabular-nums w-4">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <div className="font-mono text-base">{r.symbol}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-base-content/40 mt-0.5">
                  {r.name}
                </div>
              </div>
            </div>
            <div className="col-span-12 md:col-span-5">
              <div className="flex items-center gap-3">
                <div className="font-mono tabular-nums text-base w-20">{(r.scoreBps / 100).toFixed(2)}%</div>
                <div className="flex-1 h-2 bg-base-300 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(r.scoreBps / max) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="col-span-6 md:col-span-2 text-right font-mono tabular-nums text-base-content/80">
              {r.lenders}
            </div>
            <div className="col-span-6 md:col-span-2 text-right font-mono tabular-nums text-primary">
              {(r.avgLtvBps / 100).toFixed(2)}%
            </div>
          </div>
        ))}
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

export default Scores;
