"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { parseUnits } from "viem";
import { useAccount } from "wagmi";
import { Skeleton } from "~~/components/maeve/Skeleton";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import { MAEVE_TOKENS, MaeveTokenConfig, formatBpsAsPercent, formatToken, useMaeveTokens } from "~~/utils/maeve";

type LoanStruct = {
  borrower: `0x${string}`;
  borrowToken: `0x${string}`;
  borrowAmount: bigint;
  collateralToken: `0x${string}`;
  collateralAmount: bigint;
  borrowTimestamp: bigint;
  active: boolean;
};

const Borrow: NextPage = () => {
  const { address: user } = useAccount();
  const { entries, byAddress } = useMaeveTokens();
  const [borrowSymbol, setBorrowSymbol] = useState(MAEVE_TOKENS[0].symbol);
  const [borrowAmount, setBorrowAmount] = useState("");
  const [collateralSymbol, setCollateralSymbol] = useState(MAEVE_TOKENS[1].symbol);
  const [collateralAmount, setCollateralAmount] = useState("");

  const borrowEntry = entries.find(e => e.config.symbol === borrowSymbol);
  const collateralEntry = entries.find(e => e.config.symbol === collateralSymbol);

  const { data: effLtvBps } = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "getEffectiveLTV",
    args: [borrowEntry?.address, collateralEntry?.address],
  });
  const { data: availLiquidity } = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "getAvailableLiquidity",
    args: [borrowEntry?.address],
  });
  const { data: borrowRateBps } = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "interestRateBps",
    args: [borrowEntry?.address],
  });
  const { data: nextLoanId } = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "nextLoanId",
  });

  // Required collateral derived client-side: required = borrowAmount * 10000 / effLtvBps
  // (matches the on-chain formula in MaevePool.borrow). 1:1 price assumption applies.
  let requiredCollateralLabel: React.ReactNode = "—";
  let parsedBorrow: bigint | undefined;
  try {
    if (borrowAmount && Number(borrowAmount) > 0) parsedBorrow = parseUnits(borrowAmount, 18);
  } catch {
    /* ignore parse error */
  }
  if (effLtvBps !== undefined) {
    const ltv = effLtvBps as bigint;
    if (ltv === 0n) {
      requiredCollateralLabel = "no lender accepts pair";
    } else if (parsedBorrow !== undefined) {
      const required = (parsedBorrow * 10000n) / ltv;
      requiredCollateralLabel = `${formatToken(required)} ${collateralSymbol}`;
    }
  } else {
    requiredCollateralLabel = <Skeleton width="5rem" />;
  }

  const totalLoans = nextLoanId !== undefined ? Number(nextLoanId) : undefined;

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
                value={borrowSymbol}
                onChange={e => setBorrowSymbol(e.target.value)}
                className="maeve-input w-full px-3 py-3 text-base"
              >
                {entries.map(e => (
                  <option key={e.config.contractName} value={e.config.symbol}>
                    {e.config.symbol}
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
                value={collateralSymbol}
                onChange={e => setCollateralSymbol(e.target.value)}
                className="maeve-input w-full px-3 py-3 text-base"
              >
                {entries.map(e => (
                  <option key={e.config.contractName} value={e.config.symbol}>
                    {e.config.symbol}
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
            <div className="font-mono text-5xl tabular-nums text-primary leading-none">
              {effLtvBps !== undefined ? formatBpsAsPercent(effLtvBps as bigint) : <Skeleton width="6rem" />}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-base-content/40 mt-2">
              average across accepting lenders
            </div>
          </div>
          <div className="text-xs text-base-content/50 leading-relaxed">
            How much of {borrowSymbol} lenders will let you borrow per unit of {collateralSymbol}.
          </div>
          <div className="mt-auto pt-4 maeve-divider flex flex-col gap-2">
            <RowStat label="Required collateral" value={requiredCollateralLabel} />
            <RowStat
              label="Available liquidity"
              value={
                availLiquidity !== undefined ? (
                  `${formatToken(availLiquidity as bigint)} ${borrowSymbol}`
                ) : (
                  <Skeleton width="5rem" />
                )
              }
            />
            <RowStat
              label="Interest rate"
              value={
                borrowRateBps !== undefined ? formatBpsAsPercent(borrowRateBps as bigint) : <Skeleton width="3rem" />
              }
            />
          </div>
        </div>
      </section>

      <section className="maeve-card p-6">
        <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/50 mb-5">My Loans</h2>
        {/* HACKATHON: O(n) loan scan. Real app uses a subgraph or indexed events. */}
        {!user ? (
          <EmptyPanel label="Connect your wallet to view loans" />
        ) : totalLoans === undefined ? (
          <EmptyPanel label="Loading..." />
        ) : totalLoans === 0 ? (
          <EmptyPanel label="No loans yet" />
        ) : (
          <MyLoansList user={user as `0x${string}`} totalLoans={totalLoans} byAddress={byAddress} />
        )}
      </section>
    </div>
  );
};

function MyLoansList({
  user,
  totalLoans,
  byAddress,
}: {
  user: `0x${string}`;
  totalLoans: number;
  byAddress: Map<string, MaeveTokenConfig>;
}) {
  return (
    <div className="flex flex-col">
      <div className="hidden md:grid grid-cols-12 gap-4 pb-3 text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/40 border-b border-white/5">
        <div className="col-span-1">#</div>
        <div className="col-span-3">Borrowed</div>
        <div className="col-span-3">Collateral</div>
        <div className="col-span-3">Owed Now</div>
        <div className="col-span-2 text-right">Opened</div>
      </div>
      {Array.from({ length: totalLoans }, (_, i) => (
        <MaybeLoanRow key={i} loanId={BigInt(i)} user={user} byAddress={byAddress} />
      ))}
    </div>
  );
}

function MaybeLoanRow({
  loanId,
  user,
  byAddress,
}: {
  loanId: bigint;
  user: `0x${string}`;
  byAddress: Map<string, MaeveTokenConfig>;
}) {
  const { data } = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "getLoanDetails",
    args: [loanId],
  });
  const { data: owed } = useScaffoldReadContract({
    contractName: "MaevePool",
    functionName: "getOutstandingDebt",
    args: [loanId],
  });
  const loan = data as LoanStruct | undefined;

  if (!loan) return null;
  if (!loan.active) return null;
  if (loan.borrower.toLowerCase() !== user.toLowerCase()) return null;

  const borrowSymbol = byAddress.get(loan.borrowToken.toLowerCase())?.symbol ?? loan.borrowToken.slice(0, 6);
  const collateralSymbol =
    byAddress.get(loan.collateralToken.toLowerCase())?.symbol ?? loan.collateralToken.slice(0, 6);
  const opened = new Date(Number(loan.borrowTimestamp) * 1000).toLocaleDateString();

  return (
    <div className="grid grid-cols-12 gap-4 py-4 items-center border-b border-white/5 last:border-b-0">
      <div className="col-span-1 font-mono text-base-content/40 text-xs">#{loanId.toString()}</div>
      <div className="col-span-12 md:col-span-3 font-mono">
        <div className="tabular-nums">{formatToken(loan.borrowAmount)}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-base-content/40 mt-0.5">{borrowSymbol}</div>
      </div>
      <div className="col-span-12 md:col-span-3 font-mono">
        <div className="tabular-nums">{formatToken(loan.collateralAmount)}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-base-content/40 mt-0.5">{collateralSymbol}</div>
      </div>
      <div className="col-span-12 md:col-span-3 font-mono text-primary tabular-nums">
        {owed !== undefined ? `${formatToken(owed as bigint)} ${borrowSymbol}` : <Skeleton width="6rem" />}
      </div>
      <div className="col-span-12 md:col-span-2 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-base-content/50">
        {opened}
      </div>
    </div>
  );
}

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

function RowStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-xs font-mono">
      <span className="text-base-content/50 uppercase tracking-[0.2em]">{label}</span>
      <span className="tabular-nums text-base-content/80">{value}</span>
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <div className="text-base-content/30 text-2xl font-mono">—</div>
      <div className="text-xs text-base-content/40 font-mono uppercase tracking-[0.2em]">{label}</div>
    </div>
  );
}

export default Borrow;
