"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { formatUnits, parseUnits } from "viem";
import { Skeleton } from "~~/components/maeve/Skeleton";
import { useMaeveContext } from "~~/hooks/maeve";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import { MaeveTokenEntry, TOKEN_DECIMALS, bpsToPercentNumber, formatBpsAsPercent, formatToken } from "~~/utils/maeve";

const FAUCET_AMOUNT = parseUnits("10000", 18);

const Dashboard: NextPage = () => {
  const { entries, tokenWrites, user, balance } = useMaeveContext();
  const { data: nextLoanId } = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "nextLoanId",
  });

  return (
    <div className="flex flex-col grow w-full max-w-7xl mx-auto px-4 sm:px-6 py-12 gap-12">
      <header className="border-b border-white/5 pb-10">
        <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-base-content/40 mb-3">
          maeve // protocol
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tight mb-4">Maeve Finance.</h1>
        <p className="text-base sm:text-lg text-base-content/60 max-w-2xl">Lending where lenders set the rules.</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SumStat label="Total Deposited" entries={entries} functionName="totalDeposited" />
        <SumStat label="Total Borrowed" entries={entries} functionName="totalBorrowed" />
        {/* SHORTCUT: nextLoanId counts every loan ever created, not currently-active. */}
        <CountStat label="Active Loans" value={nextLoanId !== undefined ? Number(nextLoanId) : undefined} />
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
            className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary hover:opacity-80 whitespace-nowrap"
          >
            View leaderboard →
          </Link>
        </div>
        {/* Mobile: horizontal scroll. Desktop: 3-up grid. */}
        <div className="flex md:grid md:grid-cols-3 gap-4 overflow-x-auto md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory md:snap-none">
          {entries.map(e => (
            <div key={e.config.contractName} className="snap-center shrink-0 w-[80%] md:w-auto md:shrink">
              <TokenScoreCard entry={e} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-5">
          <h2 className="text-xl font-medium">How It Works</h2>
          <p className="text-sm text-base-content/50 mt-1">
            Three steps. Lenders pick the rules; borrowers play within them.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <HowCard
            step="01"
            title="Deposit & Set Rules"
            body="Provide liquidity, then choose which collateral types can back loans against your funds — and at what max LTV."
          />
          <HowCard
            step="02"
            title="AI Analyzes Risk"
            body="Maeve's risk agent recommends accept/reject and LTV per pair based on your risk tolerance. Apply with one click."
          />
          <HowCard
            step="03"
            title="Borrowers Access Liquidity"
            body="Borrowers see live aggregate LTVs derived from active lender preferences. They borrow only on terms lenders signed off on."
          />
        </div>
      </section>

      <section className="maeve-card p-6">
        <div className="flex items-baseline justify-between mb-5 gap-4">
          <div>
            <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/50 mb-1">Faucet</h2>
            <p className="text-sm text-base-content/60">
              Mint mock tokens to play with the protocol. Hackathon-only — these are worthless.
            </p>
          </div>
        </div>
        {!user ? (
          <div className="text-xs text-base-content/40 font-mono uppercase tracking-[0.2em] py-6">
            Connect your wallet to mint mock tokens.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {entries.map(e => (
              <FaucetCard
                key={e.config.contractName}
                entry={e}
                user={user as `0x${string}`}
                writer={tokenWrites[e.config.contractName]}
                balance={balance[e.config.contractName]}
              />
            ))}
          </div>
        )}
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

/** easeOutCubic count-up animation; honors prefers-reduced-motion. */
function useCountUp(target: number | undefined, duration = 900) {
  const [value, setValue] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    if (target === undefined) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      prevRef.current = target;
      return;
    }
    const from = prevRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return target === undefined ? undefined : value;
}

function SumStat({
  label,
  entries,
  functionName,
}: {
  label: string;
  entries: MaeveTokenEntry[];
  functionName: "totalDeposited" | "totalBorrowed";
}) {
  const usdc = useScaffoldReadContract({ contractName: "MaevePool", functionName, args: [entries[0].address] });
  const weth = useScaffoldReadContract({ contractName: "MaevePool", functionName, args: [entries[1].address] });
  const wbtc = useScaffoldReadContract({ contractName: "MaevePool", functionName, args: [entries[2].address] });

  const ready = usdc.data !== undefined && weth.data !== undefined && wbtc.data !== undefined;
  const totalUnits = ready
    ? Number(formatUnits((usdc.data as bigint) + (weth.data as bigint) + (wbtc.data as bigint), TOKEN_DECIMALS))
    : undefined;

  const animated = useCountUp(totalUnits);
  const displayed =
    animated === undefined
      ? undefined
      : animated.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return <StatCard label={label} value={displayed} />;
}

function CountStat({ label, value }: { label: string; value?: number }) {
  const animated = useCountUp(value);
  const displayed = animated === undefined ? undefined : Math.round(animated).toLocaleString("en-US");
  return <StatCard label={label} value={displayed} />;
}

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

function HowCard({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div className="maeve-card p-5 flex flex-col gap-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary">{step}</div>
      <div className="text-lg font-light">{title}</div>
      <p className="text-sm text-base-content/60 leading-relaxed">{body}</p>
    </div>
  );
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
    <div className="maeve-card maeve-card-hover p-5 h-full">
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

function FaucetCard({
  entry,
  user,
  writer,
  balance,
}: {
  entry: MaeveTokenEntry;
  user: `0x${string}`;
  writer: ReturnType<typeof useMaeveContext>["tokenWrites"][keyof ReturnType<typeof useMaeveContext>["tokenWrites"]];
  balance: bigint | undefined;
}) {
  const onMint = async () => {
    try {
      await writer.writeContractAsync({ functionName: "mint", args: [user, FAUCET_AMOUNT] });
    } catch {
      // toast surfaced by useTransactor
    }
  };
  return (
    <div
      className="rounded-lg p-5 flex flex-col gap-3"
      style={{ border: "1px solid rgba(255,255,255,0.06)", background: "var(--color-base-200)" }}
    >
      <div className="flex items-baseline justify-between">
        <div className="font-mono text-sm">{entry.config.symbol}</div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-base-content/40">balance</div>
      </div>
      <div className="font-mono text-xl tabular-nums">
        {balance !== undefined ? formatToken(balance) : <Skeleton width="4rem" />}
      </div>
      <button
        onClick={onMint}
        disabled={writer.isMining}
        className="btn btn-primary btn-sm font-mono uppercase tracking-[0.2em] text-[10px]"
      >
        {writer.isMining ? "Minting…" : `Mint 10,000 ${entry.config.symbol}`}
      </button>
    </div>
  );
}

export default Dashboard;
