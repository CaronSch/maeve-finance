"use client";

import { useState } from "react";
import type { NextPage } from "next";

const tokens = ["mUSDC", "mWETH", "mWBTC"];

const Borrow: NextPage = () => {
  const [borrowToken, setBorrowToken] = useState("mUSDC");
  const [borrowAmount, setBorrowAmount] = useState("");
  const [collateralToken, setCollateralToken] = useState("mWETH");
  const [collateralAmount, setCollateralAmount] = useState("");

  return (
    <div className="flex flex-col grow w-full max-w-7xl mx-auto px-6 py-12 gap-10">
      <header>
        <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-base-content/40 mb-2">borrow</div>
        <h1 className="text-3xl font-light">Borrow against your collateral.</h1>
        <p className="text-base-content/60 mt-2 text-sm max-w-2xl">
          Your maximum LTV is decided by the lenders willing to accept the collateral you&apos;re posting. The number
          updates live as lenders change their preferences.
        </p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="maeve-card p-6 lg:col-span-2">
          <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/50 mb-5">Open Position</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5">
            <Field label="Borrow Token">
              <select
                value={borrowToken}
                onChange={e => setBorrowToken(e.target.value)}
                className="maeve-input w-full px-3 py-3 text-base"
              >
                {tokens.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Borrow Amount">
              <input
                type="text"
                placeholder="0.00"
                value={borrowAmount}
                onChange={e => setBorrowAmount(e.target.value)}
                className="maeve-input w-full px-3 py-3 text-base"
              />
            </Field>
            <Field label="Collateral Token">
              <select
                value={collateralToken}
                onChange={e => setCollateralToken(e.target.value)}
                className="maeve-input w-full px-3 py-3 text-base"
              >
                {tokens.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Collateral Amount">
              <input
                type="text"
                placeholder="0.00"
                value={collateralAmount}
                onChange={e => setCollateralAmount(e.target.value)}
                className="maeve-input w-full px-3 py-3 text-base"
              />
            </Field>
            <div className="md:col-span-2">
              <button className="btn btn-primary w-full font-mono uppercase tracking-[0.2em] text-xs" disabled>
                Borrow
              </button>
            </div>
          </div>
        </div>

        <div className="maeve-card p-6 flex flex-col gap-4">
          <div>
            <h3 className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/50 mb-3">
              Effective LTV
            </h3>
            <div className="font-mono text-5xl tabular-nums text-primary leading-none">—</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-base-content/40 mt-2">
              average across accepting lenders
            </div>
          </div>
          <div className="text-xs text-base-content/50 leading-relaxed">
            How much of {borrowToken} lenders will let you borrow per unit of {collateralToken}.
          </div>
          <div className="mt-auto pt-4 maeve-divider flex flex-col gap-2">
            <RowStat label="Required collateral" value="—" />
            <RowStat label="Available liquidity" value="—" />
            <RowStat label="Interest rate" value="—" />
          </div>
        </div>
      </section>

      <section className="maeve-card p-6">
        <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/50 mb-5">My Loans</h2>
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <div className="text-base-content/30 text-2xl font-mono">—</div>
          <div className="text-xs text-base-content/40 font-mono uppercase tracking-[0.2em]">No active loans</div>
        </div>
      </section>
    </div>
  );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/40 mb-2 block">
        {label}
      </label>
      {children}
    </div>
  );
}

function RowStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs font-mono">
      <span className="text-base-content/50 uppercase tracking-[0.2em]">{label}</span>
      <span className="tabular-nums text-base-content/80">{value}</span>
    </div>
  );
}

export default Borrow;
