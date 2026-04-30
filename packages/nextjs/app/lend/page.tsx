"use client";

import { useState } from "react";
import type { NextPage } from "next";

const tokens = ["mUSDC", "mWETH", "mWBTC"];

const Lend: NextPage = () => {
  const [depositToken, setDepositToken] = useState("mUSDC");
  const [amount, setAmount] = useState("");

  return (
    <div className="flex flex-col grow w-full max-w-7xl mx-auto px-6 py-12 gap-10">
      <header>
        <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-base-content/40 mb-2">lend</div>
        <h1 className="text-3xl font-light">Provide liquidity, set your terms.</h1>
        <p className="text-base-content/60 mt-2 text-sm max-w-2xl">
          Deposit a supported token, then choose which collateral types are allowed to back loans against your funds.
        </p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="maeve-card p-6">
          <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/50 mb-5">Deposit</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/40 mb-2 block">
                Token
              </label>
              <select
                value={depositToken}
                onChange={e => setDepositToken(e.target.value)}
                className="maeve-input w-full px-3 py-3 text-base"
              >
                {tokens.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/40 mb-2 block">
                Amount
              </label>
              <input
                type="text"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="maeve-input w-full px-3 py-3 text-base"
              />
              <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.2em] text-base-content/40">
                Wallet balance: —
              </div>
            </div>
            <button className="btn btn-primary mt-2 font-mono uppercase tracking-[0.2em] text-xs" disabled>
              Deposit
            </button>
          </div>
        </div>

        <div className="maeve-card p-6">
          <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/50 mb-5">My Deposits</h2>
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="text-base-content/30 text-2xl font-mono">—</div>
            <div className="text-xs text-base-content/40 font-mono uppercase tracking-[0.2em]">No deposits yet</div>
          </div>
        </div>
      </section>

      <section className="maeve-card p-6">
        <div className="mb-6">
          <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/50 mb-1">
            Collateral Preferences
          </h2>
          <p className="text-base font-light">Which tokens can back loans against your deposit?</p>
          <p className="text-sm text-base-content/50 mt-1">
            Toggle each token on and pick the maximum loan-to-value you&apos;re comfortable with. Lenders are aggregated
            into a per-token credit score borrowers see live.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tokens.map(t => (
            <CollateralToggleCard key={t} symbol={t} />
          ))}
        </div>
      </section>
    </div>
  );
};

function CollateralToggleCard({ symbol }: { symbol: string }) {
  const [active, setActive] = useState(false);
  const [ltv, setLtv] = useState(7500);

  return (
    <div
      className="rounded-lg p-5"
      style={{
        border: active ? "1px solid rgba(45,212,168,0.3)" : "1px solid rgba(255,255,255,0.06)",
        background: "var(--color-base-200)",
        transition: "border-color 200ms ease",
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="font-mono text-sm text-base-content/90">{symbol}</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-base-content/40 mt-0.5">
            {active ? "accepting" : "rejecting"}
          </div>
        </div>
        <input
          type="checkbox"
          checked={active}
          onChange={e => setActive(e.target.checked)}
          className="toggle toggle-primary toggle-sm"
        />
      </div>
      <div className={`space-y-3 ${active ? "opacity-100" : "opacity-40"}`}>
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-base-content/50 uppercase tracking-[0.2em]">Max LTV</span>
          <span className="text-primary tabular-nums">{(ltv / 100).toFixed(2)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="9000"
          step="100"
          value={ltv}
          onChange={e => setLtv(Number(e.target.value))}
          className="range range-primary range-xs"
          disabled={!active}
        />
        <div className="flex justify-between text-[10px] font-mono text-base-content/30 tabular-nums">
          <span>0%</span>
          <span>90%</span>
        </div>
      </div>
    </div>
  );
}

export default Lend;
