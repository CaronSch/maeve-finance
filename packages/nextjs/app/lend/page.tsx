"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { Skeleton } from "~~/components/maeve/Skeleton";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import {
  MAEVE_TOKENS,
  MaeveTokenEntry,
  bpsToPercentNumber,
  formatBpsAsPercent,
  formatToken,
  useMaeveTokens,
} from "~~/utils/maeve";

const Lend: NextPage = () => {
  const { address: user } = useAccount();
  const { entries } = useMaeveTokens();
  const [depositSymbol, setDepositSymbol] = useState<string>(MAEVE_TOKENS[0].symbol);
  const [amount, setAmount] = useState("");

  const depositEntry = entries.find(e => e.config.symbol === depositSymbol);

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
                value={depositSymbol}
                onChange={e => setDepositSymbol(e.target.value)}
                className="maeve-input w-full px-3 py-3 text-base"
              >
                {entries.map(e => (
                  <option key={e.config.contractName} value={e.config.symbol}>
                    {e.config.symbol}
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
              <AvailableLiquidityHint entry={depositEntry} />
            </div>
            <button className="btn btn-primary mt-2 font-mono uppercase tracking-[0.2em] text-xs" disabled>
              Deposit
            </button>
          </div>
        </div>

        <div className="maeve-card p-6">
          <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/50 mb-5">My Deposits</h2>
          {!user ? (
            <EmptyPanel label="Connect your wallet to view deposits" />
          ) : (
            <MyDepositsList user={user as `0x${string}`} entries={entries} />
          )}
        </div>
      </section>

      <section className="maeve-card p-6">
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/50 mb-1">
              Collateral Preferences
            </h2>
            <p className="text-base font-light">Which tokens can back loans against your deposit?</p>
            <p className="text-sm text-base-content/50 mt-1">
              Toggle each token on and pick the maximum loan-to-value you&apos;re comfortable with.
            </p>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/40 mb-2 block">
              For deposit
            </label>
            <select
              value={depositSymbol}
              onChange={e => setDepositSymbol(e.target.value)}
              className="maeve-input px-3 py-2 text-sm"
            >
              {entries.map(e => (
                <option key={e.config.contractName} value={e.config.symbol}>
                  {e.config.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {entries.map(e => (
            <CollateralPrefCard
              key={e.config.contractName}
              user={user as `0x${string}` | undefined}
              depositEntry={depositEntry}
              collateralEntry={e}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <div className="text-base-content/30 text-2xl font-mono">—</div>
      <div className="text-xs text-base-content/40 font-mono uppercase tracking-[0.2em]">{label}</div>
    </div>
  );
}

function AvailableLiquidityHint({ entry }: { entry?: MaeveTokenEntry }) {
  const { data: liquidity } = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "getAvailableLiquidity",
    args: [entry?.address],
  });
  return (
    <div className="mt-2 flex justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-base-content/40">
      <span>Pool available liquidity</span>
      <span className="tabular-nums text-base-content/70">
        {liquidity !== undefined ? (
          `${formatToken(liquidity as bigint)} ${entry?.config.symbol ?? ""}`
        ) : (
          <Skeleton width="5rem" />
        )}
      </span>
    </div>
  );
}

function MyDepositsList({ user, entries }: { user: `0x${string}`; entries: MaeveTokenEntry[] }) {
  return (
    <div className="flex flex-col">
      {entries.map(e => (
        <MyDepositRow key={e.config.contractName} user={user} entry={e} />
      ))}
      <NoDepositsFallback user={user} entries={entries} />
    </div>
  );
}

function MyDepositRow({ user, entry }: { user: `0x${string}`; entry: MaeveTokenEntry }) {
  const { data } = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "deposits",
    args: [entry.address, user],
  });
  const tuple = data as readonly [bigint, bigint] | undefined;
  const amount = tuple?.[0];
  if (amount === undefined || amount === 0n) return null;
  const ts = tuple?.[1];
  return (
    <div className="flex justify-between items-center py-4 border-b border-white/5 last:border-b-0">
      <div>
        <div className="font-mono text-base">{entry.config.symbol}</div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-base-content/40 mt-0.5">
          {ts !== undefined ? new Date(Number(ts) * 1000).toLocaleString() : "—"}
        </div>
      </div>
      <div className="font-mono tabular-nums text-base-content/90">{formatToken(amount)}</div>
    </div>
  );
}

/** If every read came back zero (or addresses haven't resolved yet), render a placeholder. */
function NoDepositsFallback({ user, entries }: { user: `0x${string}`; entries: MaeveTokenEntry[] }) {
  const usdc = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "deposits",
    args: [entries[0].address, user],
  });
  const weth = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "deposits",
    args: [entries[1].address, user],
  });
  const wbtc = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "deposits",
    args: [entries[2].address, user],
  });

  const allLoaded = [usdc.data, weth.data, wbtc.data].every(d => d !== undefined);
  const totalAmount = allLoaded
    ? (usdc.data as readonly [bigint, bigint])[0] +
      (weth.data as readonly [bigint, bigint])[0] +
      (wbtc.data as readonly [bigint, bigint])[0]
    : undefined;

  if (!allLoaded) return <EmptyPanel label="Loading..." />;
  if (totalAmount !== undefined && totalAmount === 0n) return <EmptyPanel label="No deposits yet" />;
  return null;
}

function CollateralPrefCard({
  user,
  depositEntry,
  collateralEntry,
}: {
  user?: `0x${string}`;
  depositEntry?: MaeveTokenEntry;
  collateralEntry: MaeveTokenEntry;
}) {
  const { data: pref } = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "collateralPrefs",
    args: [depositEntry?.address, user, collateralEntry.address],
  });
  const tuple = pref as readonly [`0x${string}`, bigint, boolean] | undefined;
  const maxLtvBps = tuple?.[1];
  const active = tuple?.[2] ?? false;

  const ltvDisplay = maxLtvBps !== undefined ? Number(maxLtvBps) : 0;

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
          <div className="font-mono text-sm text-base-content/90">{collateralEntry.config.symbol}</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-base-content/40 mt-0.5">
            {!user ? "wallet not connected" : active ? "accepting" : "not accepting"}
          </div>
        </div>
        <input type="checkbox" checked={active} readOnly disabled className="toggle toggle-primary toggle-sm" />
      </div>
      <div className={`space-y-3 ${active ? "opacity-100" : "opacity-40"}`}>
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-base-content/50 uppercase tracking-[0.2em]">Max LTV</span>
          <span className="text-primary tabular-nums">
            {maxLtvBps !== undefined ? formatBpsAsPercent(maxLtvBps) : <Skeleton width="3rem" />}
          </span>
        </div>
        <div className="h-1 bg-base-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${Math.min(bpsToPercentNumber(ltvDisplay), 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-base-content/30 tabular-nums">
          <span>0%</span>
          <span>90%</span>
        </div>
      </div>
    </div>
  );
}

export default Lend;
