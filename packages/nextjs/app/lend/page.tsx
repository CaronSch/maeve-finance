"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { parseUnits } from "viem";
import { AiRiskAgent } from "~~/components/AiRiskAgent";
import { Skeleton } from "~~/components/maeve/Skeleton";
import { MaeveContext, useMaeveContext } from "~~/hooks/maeve";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import {
  MAEVE_TOKENS,
  MAX_UINT256,
  MaeveTokenEntry,
  bpsToPercentNumber,
  formatBpsAsPercent,
  formatToken,
} from "~~/utils/maeve";

const Lend: NextPage = () => {
  const ctx = useMaeveContext();
  const [depositSymbol, setDepositSymbol] = useState(MAEVE_TOKENS[0].symbol);
  const depositEntry = ctx.entries.find(e => e.config.symbol === depositSymbol);

  return (
    <div className="flex flex-col grow w-full max-w-7xl mx-auto px-4 sm:px-6 py-12 gap-10">
      <header>
        <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-base-content/40 mb-2">lend</div>
        <h1 className="text-3xl font-light">Provide liquidity, set your terms.</h1>
        <p className="text-base-content/60 mt-2 text-sm max-w-2xl">
          Deposit a supported token, then choose which collateral types are allowed to back loans against your funds.
        </p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DepositForm ctx={ctx} symbol={depositSymbol} onSymbolChange={setDepositSymbol} />
        <div className="maeve-card p-6">
          <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/50 mb-5">My Deposits</h2>
          {!ctx.user ? <EmptyPanel label="Connect your wallet to view deposits" /> : <MyDepositsList ctx={ctx} />}
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
              Toggle each token on and pick the maximum loan-to-value you&apos;re comfortable with. Changes save
              automatically.
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
              {ctx.entries.map(e => (
                <option key={e.config.contractName} value={e.config.symbol}>
                  {e.config.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>
        <CollateralPrefsGrid ctx={ctx} depositEntry={depositEntry} />
      </section>

      <div className="flex items-center gap-4 my-2">
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-base-content/40">or let AI decide</span>
        <div className="flex-1 h-px bg-white/5" />
      </div>

      <AiRiskAgent />
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

function DepositForm({
  ctx,
  symbol,
  onSymbolChange,
}: {
  ctx: MaeveContext;
  symbol: string;
  onSymbolChange: (s: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const entry = ctx.entries.find(e => e.config.symbol === symbol);
  const cn = entry?.config.contractName;
  const allowance = cn ? ctx.allowance[cn] : undefined;
  const balance = cn ? ctx.balance[cn] : undefined;

  let parsedAmount: bigint | undefined;
  try {
    if (amount && Number(amount) > 0) parsedAmount = parseUnits(amount, 18);
  } catch {
    /* ignore */
  }

  const insufficientBalance = parsedAmount !== undefined && balance !== undefined && parsedAmount > balance;
  const needsApproval = parsedAmount !== undefined && (allowance === undefined || allowance < parsedAmount);

  const writer = cn ? ctx.tokenWrites[cn] : undefined;
  const isApproving = writer?.isMining ?? false;
  const isDepositing = ctx.poolWrite.isMining;

  const onApprove = async () => {
    if (!writer || !ctx.poolAddress) return;
    try {
      await writer.writeContractAsync({
        functionName: "approve",
        args: [ctx.poolAddress, MAX_UINT256],
      });
    } catch {
      /* error toast surfaced by useTransactor */
    }
  };

  const onDeposit = async () => {
    if (!parsedAmount || !entry?.address) return;
    try {
      await ctx.poolWrite.writeContractAsync({
        functionName: "deposit",
        args: [entry.address, parsedAmount],
      });
      setAmount("");
    } catch {
      /* error toast surfaced by useTransactor */
    }
  };

  // Available liquidity for the selected pool — informational only.
  const { data: liquidity } = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "getAvailableLiquidity",
    args: [entry?.address],
  });

  return (
    <div className="maeve-card p-6">
      <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/50 mb-5">Deposit</h2>
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/40 mb-2 block">
            Token
          </label>
          <select
            value={symbol}
            onChange={e => onSymbolChange(e.target.value)}
            className="maeve-input w-full px-3 py-3 text-base"
          >
            {ctx.entries.map(e => (
              <option key={e.config.contractName} value={e.config.symbol}>
                {e.config.symbol}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/40">Amount</label>
            <button
              type="button"
              className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary hover:opacity-80"
              onClick={() => {
                if (balance !== undefined) setAmount((Number(balance) / 1e18).toString());
              }}
            >
              Max
            </button>
          </div>
          <input
            type="text"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="maeve-input w-full px-3 py-3 text-base"
          />
          <div className="mt-2 flex justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-base-content/40">
            <span>Wallet</span>
            <span className="tabular-nums text-base-content/70">
              {balance !== undefined ? `${formatToken(balance)} ${symbol}` : <Skeleton width="5rem" />}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-base-content/40">
            <span>Pool available liquidity</span>
            <span className="tabular-nums text-base-content/70">
              {liquidity !== undefined ? `${formatToken(liquidity as bigint)} ${symbol}` : <Skeleton width="5rem" />}
            </span>
          </div>
          {ctx.user && balance === 0n && (
            <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.2em] text-warning">
              No {symbol}.{" "}
              <Link href="/" className="underline hover:opacity-80">
                Mint from the dashboard faucet
              </Link>
              .
            </div>
          )}
        </div>
        {!ctx.user ? (
          <button className="btn btn-primary mt-2 font-mono uppercase tracking-[0.2em] text-xs" disabled>
            Connect wallet
          </button>
        ) : insufficientBalance ? (
          <button className="btn btn-warning mt-2 font-mono uppercase tracking-[0.2em] text-xs" disabled>
            Insufficient balance
          </button>
        ) : needsApproval ? (
          <button
            className="btn btn-primary mt-2 font-mono uppercase tracking-[0.2em] text-xs"
            disabled={!parsedAmount || isApproving}
            onClick={onApprove}
          >
            {isApproving ? "Approving…" : `Approve ${symbol}`}
          </button>
        ) : (
          <button
            className="btn btn-primary mt-2 font-mono uppercase tracking-[0.2em] text-xs"
            disabled={!parsedAmount || isDepositing}
            onClick={onDeposit}
          >
            {isDepositing ? "Depositing…" : "Deposit"}
          </button>
        )}
      </div>
    </div>
  );
}

function MyDepositsList({ ctx }: { ctx: MaeveContext }) {
  return (
    <div className="flex flex-col">
      {ctx.entries.map(e => (
        <MyDepositRow key={e.config.contractName} ctx={ctx} entry={e} />
      ))}
      <NoDepositsFallback ctx={ctx} />
    </div>
  );
}

function MyDepositRow({ ctx, entry }: { ctx: MaeveContext; entry: MaeveTokenEntry }) {
  const { data } = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "deposits",
    args: [entry.address, ctx.user],
  });
  const { data: liquidity } = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "getAvailableLiquidity",
    args: [entry.address],
  });
  const tuple = data as readonly [bigint, bigint] | undefined;
  const amount = tuple?.[0];
  const ts = tuple?.[1];
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const isMining = ctx.poolWrite.isMining;

  if (amount === undefined || amount === 0n) return null;

  const maxWithdrawable =
    liquidity !== undefined && amount !== undefined ? (liquidity < amount ? liquidity : amount) : undefined;

  let parsedWithdraw: bigint | undefined;
  try {
    if (withdrawAmount && Number(withdrawAmount) > 0) parsedWithdraw = parseUnits(withdrawAmount, 18);
  } catch {
    /* ignore */
  }

  const overMax = parsedWithdraw !== undefined && maxWithdrawable !== undefined && parsedWithdraw > maxWithdrawable;

  const onWithdraw = async () => {
    if (!parsedWithdraw || !entry.address) return;
    try {
      await ctx.poolWrite.writeContractAsync({
        functionName: "withdraw",
        args: [entry.address, parsedWithdraw],
      });
      setWithdrawAmount("");
    } catch {
      /* error toast already raised */
    }
  };

  return (
    <div className="flex flex-col py-4 border-b border-white/5 last:border-b-0 gap-3">
      <div className="flex justify-between items-center">
        <div>
          <div className="font-mono text-base">{entry.config.symbol}</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-base-content/40 mt-0.5">
            {ts !== undefined && ts > 0n ? `since ${new Date(Number(ts) * 1000).toLocaleDateString()}` : "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono tabular-nums text-base-content/90">{formatToken(amount)}</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-base-content/40 mt-0.5">
            max withdrawable {maxWithdrawable !== undefined ? formatToken(maxWithdrawable) : "—"}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="0.00"
          value={withdrawAmount}
          onChange={e => setWithdrawAmount(e.target.value)}
          className="maeve-input flex-1 px-3 py-2 text-sm"
        />
        <button
          type="button"
          className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary hover:opacity-80 px-2"
          onClick={() => {
            if (maxWithdrawable !== undefined) setWithdrawAmount((Number(maxWithdrawable) / 1e18).toString());
          }}
        >
          Max
        </button>
        <button
          className="btn btn-sm btn-primary font-mono uppercase tracking-[0.2em] text-[10px]"
          disabled={!parsedWithdraw || overMax || isMining}
          onClick={onWithdraw}
        >
          {isMining ? "…" : "Withdraw"}
        </button>
      </div>
      {overMax && (
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-warning">Exceeds max withdrawable</div>
      )}
    </div>
  );
}

function NoDepositsFallback({ ctx }: { ctx: MaeveContext }) {
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

function CollateralPrefsGrid({ ctx, depositEntry }: { ctx: MaeveContext; depositEntry?: MaeveTokenEntry }) {
  // Need to know whether the user has a deposit in the chosen pool — required
  // by setCollateralPreference. Without it, the tx would revert.
  const { data: dep } = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "deposits",
    args: [depositEntry?.address, ctx.user],
  });
  const tuple = dep as readonly [bigint, bigint] | undefined;
  const userHasDeposit = (tuple?.[0] ?? 0n) > 0n;

  return (
    <>
      {!ctx.user && (
        <div className="mb-4 text-xs font-mono uppercase tracking-[0.2em] text-base-content/40">
          Connect wallet to manage preferences.
        </div>
      )}
      {ctx.user && depositEntry && !userHasDeposit && (
        <div className="mb-4 text-xs font-mono uppercase tracking-[0.2em] text-warning">
          You need a {depositEntry.config.symbol} deposit before you can configure preferences.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ctx.entries.map(e => (
          <CollateralPrefCard
            key={e.config.contractName}
            ctx={ctx}
            depositEntry={depositEntry}
            collateralEntry={e}
            userHasDeposit={userHasDeposit}
          />
        ))}
      </div>
    </>
  );
}

function CollateralPrefCard({
  ctx,
  depositEntry,
  collateralEntry,
  userHasDeposit,
}: {
  ctx: MaeveContext;
  depositEntry?: MaeveTokenEntry;
  collateralEntry: MaeveTokenEntry;
  userHasDeposit: boolean;
}) {
  const { data: pref } = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "collateralPrefs",
    args: [depositEntry?.address, ctx.user, collateralEntry.address],
  });
  const tuple = pref as readonly [`0x${string}`, bigint, boolean] | undefined;

  // Aggregate stats: how many lenders accept this pair, at what avg LTV.
  const { data: pairData } = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "getPairAcceptance",
    args: [depositEntry?.address, collateralEntry.address],
  });
  const pairTuple = pairData as readonly [bigint, bigint] | undefined;
  const avgLtvBps = pairTuple?.[0];
  const numLenders = pairTuple?.[1];

  const [active, setActive] = useState(false);
  const [ltv, setLtv] = useState(7500);
  const [dirty, setDirty] = useState(false);

  // Reconcile local state with on-chain state whenever the latter updates and
  // the user hasn't queued a pending change.
  useEffect(() => {
    if (dirty || !tuple) return;
    setActive(tuple[2]);
    const onChainLtv = Number(tuple[1]);
    setLtv(onChainLtv > 0 ? onChainLtv : 7500);
  }, [tuple, dirty]);

  // SHORTCUT: One tx per change. No batching across multiple cards.
  // A real protocol would expose a setCollateralPreferences(...) batch fn.
  useEffect(() => {
    if (!dirty || !ctx.user || !depositEntry?.address || !userHasDeposit) return;
    const t = setTimeout(async () => {
      try {
        await ctx.poolWrite.writeContractAsync({
          functionName: "setCollateralPreference",
          args: [depositEntry.address!, collateralEntry.address!, BigInt(ltv), active],
        });
      } catch {
        /* tx rejected/reverted — toast already shown */
      } finally {
        setDirty(false);
      }
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ltv, dirty]);

  const disabled = !ctx.user || !userHasDeposit || ctx.poolWrite.isMining;

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
            {!ctx.user
              ? "wallet not connected"
              : !userHasDeposit
                ? "no deposit in pool"
                : dirty
                  ? "saving…"
                  : active
                    ? "accepting"
                    : "not accepting"}
          </div>
        </div>
        <input
          type="checkbox"
          checked={active}
          disabled={disabled}
          onChange={e => {
            setActive(e.target.checked);
            setDirty(true);
          }}
          className="toggle toggle-primary toggle-sm"
        />
      </div>
      <div className={`space-y-3 ${active ? "opacity-100" : "opacity-40"}`}>
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-base-content/50 uppercase tracking-[0.2em]">Max LTV</span>
          <span className="text-primary tabular-nums">{formatBpsAsPercent(ltv)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={9000}
          step={100}
          value={ltv}
          disabled={disabled || !active}
          onChange={e => {
            setLtv(Number(e.target.value));
            setDirty(true);
          }}
          className="range range-primary range-xs"
        />
        <div className="h-1 bg-base-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${Math.min(bpsToPercentNumber(ltv), 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-base-content/30 tabular-nums">
          <span>0%</span>
          <span>90%</span>
        </div>
      </div>

      <PairAggregateBanner
        depositSymbol={depositEntry?.config.symbol ?? "—"}
        collateralSymbol={collateralEntry.config.symbol}
        numLenders={numLenders}
        avgLtvBps={avgLtvBps}
        userActive={active}
        userLtvBps={ltv}
      />
    </div>
  );
}

function PairAggregateBanner({
  depositSymbol,
  collateralSymbol,
  numLenders,
  avgLtvBps,
  userActive,
  userLtvBps,
}: {
  depositSymbol: string;
  collateralSymbol: string;
  numLenders: bigint | undefined;
  avgLtvBps: bigint | undefined;
  userActive: boolean;
  userLtvBps: number;
}) {
  if (numLenders === undefined || avgLtvBps === undefined) return null;
  const count = Number(numLenders);
  if (count === 0) {
    return (
      <div className="mt-4 pt-3 maeve-divider text-[10px] font-mono uppercase tracking-[0.2em] text-base-content/40">
        Be the first to accept this pair.
      </div>
    );
  }
  const avg = Number(avgLtvBps);
  const delta = userLtvBps - avg;
  const showDelta = userActive && Math.abs(delta) > 0;
  return (
    <div className="mt-4 pt-3 maeve-divider flex items-center justify-between gap-2">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-base-content/50 leading-snug">
        {count} lender{count === 1 ? "" : "s"} accept {collateralSymbol} for {depositSymbol}
        <br />
        avg {formatBpsAsPercent(avgLtvBps)}
      </div>
      {showDelta && (
        <span
          className={`text-[10px] font-mono uppercase tracking-[0.2em] tabular-nums px-2 py-1 rounded shrink-0 ${
            delta > 0 ? "text-primary" : "text-warning"
          }`}
          style={{
            border: `1px solid ${delta > 0 ? "rgba(45,212,168,0.3)" : "rgba(245,158,11,0.3)"}`,
          }}
        >
          {delta > 0 ? "+" : ""}
          {(delta / 100).toFixed(2)}%
        </span>
      )}
    </div>
  );
}

export default Lend;
