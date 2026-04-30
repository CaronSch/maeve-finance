"use client";

import { useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { formatUnits, parseUnits } from "viem";
import { Skeleton } from "~~/components/maeve/Skeleton";
import { MaeveContext, useMaeveContext } from "~~/hooks/maeve";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import { MAEVE_TOKENS, MAX_UINT256, MaeveTokenConfig, formatBpsAsPercent, formatToken } from "~~/utils/maeve";

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
  const ctx = useMaeveContext();
  const [borrowSymbol, setBorrowSymbol] = useState(MAEVE_TOKENS[0].symbol);
  const [borrowAmount, setBorrowAmount] = useState("");
  const [collateralSymbol, setCollateralSymbol] = useState(MAEVE_TOKENS[1].symbol);
  const [collateralAmount, setCollateralAmount] = useState("");

  const borrowEntry = ctx.entries.find(e => e.config.symbol === borrowSymbol);
  const collateralEntry = ctx.entries.find(e => e.config.symbol === collateralSymbol);

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

  let parsedBorrow: bigint | undefined;
  try {
    if (borrowAmount && Number(borrowAmount) > 0) parsedBorrow = parseUnits(borrowAmount, 18);
  } catch {
    /* ignore */
  }
  let parsedCollateral: bigint | undefined;
  try {
    if (collateralAmount && Number(collateralAmount) > 0) parsedCollateral = parseUnits(collateralAmount, 18);
  } catch {
    /* ignore */
  }

  // required = borrowAmount * 10000 / effLtvBps (matches on-chain formula).
  let requiredCollateral: bigint | undefined;
  if (parsedBorrow !== undefined && effLtvBps !== undefined) {
    const ltv = effLtvBps as bigint;
    if (ltv > 0n) requiredCollateral = (parsedBorrow * 10000n) / ltv;
  }

  let requiredCollateralLabel: React.ReactNode = "—";
  if (effLtvBps !== undefined) {
    const ltv = effLtvBps as bigint;
    if (ltv === 0n) {
      requiredCollateralLabel = "no lender accepts pair";
    } else if (requiredCollateral !== undefined) {
      requiredCollateralLabel = `${formatToken(requiredCollateral)} ${collateralSymbol}`;
    }
  } else {
    requiredCollateralLabel = <Skeleton width="5rem" />;
  }

  const totalLoans = nextLoanId !== undefined ? Number(nextLoanId) : undefined;

  // --- Borrow tx state ---
  const collateralCN = collateralEntry?.config.contractName;
  const collateralAllowance = collateralCN ? ctx.allowance[collateralCN] : undefined;
  const collateralBalance = collateralCN ? ctx.balance[collateralCN] : undefined;
  const collateralWriter = collateralCN ? ctx.tokenWrites[collateralCN] : undefined;

  const insufficientCollateralBal =
    parsedCollateral !== undefined && collateralBalance !== undefined && parsedCollateral > collateralBalance;
  const needsCollateralApproval =
    parsedCollateral !== undefined && (collateralAllowance === undefined || collateralAllowance < parsedCollateral);

  const undercollateralized =
    parsedCollateral !== undefined && requiredCollateral !== undefined && parsedCollateral < requiredCollateral;
  const insufficientLiquidity =
    parsedBorrow !== undefined && availLiquidity !== undefined && parsedBorrow > (availLiquidity as bigint);
  const noPair = effLtvBps !== undefined && (effLtvBps as bigint) === 0n;

  const onApproveCollateral = async () => {
    if (!collateralWriter || !ctx.poolAddress) return;
    try {
      await collateralWriter.writeContractAsync({
        functionName: "approve",
        args: [ctx.poolAddress, MAX_UINT256],
      });
    } catch {
      /* error toast surfaced */
    }
  };

  const onBorrow = async () => {
    if (!parsedBorrow || !parsedCollateral || !borrowEntry?.address || !collateralEntry?.address) return;
    try {
      await ctx.poolWrite.writeContractAsync({
        functionName: "borrow",
        args: [borrowEntry.address, parsedBorrow, collateralEntry.address, parsedCollateral],
      });
      setBorrowAmount("");
      setCollateralAmount("");
    } catch {
      /* error toast surfaced */
    }
  };

  const fillRequiredCollateral = () => {
    if (requiredCollateral !== undefined) setCollateralAmount(formatUnits(requiredCollateral, 18));
  };

  const isSamePair = borrowSymbol === collateralSymbol;
  const isMining = ctx.poolWrite.isMining;
  const isApproving = collateralWriter?.isMining ?? false;

  return (
    <div className="flex flex-col grow w-full max-w-7xl mx-auto px-4 sm:px-6 py-12 gap-10">
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
                {ctx.entries.map(e => (
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
                {ctx.entries.map(e => (
                  <option key={e.config.contractName} value={e.config.symbol}>
                    {e.config.symbol}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Collateral Amount">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="0.00"
                  value={collateralAmount}
                  onChange={e => setCollateralAmount(e.target.value)}
                  className="maeve-input flex-1 px-3 py-3 text-base"
                />
                <button
                  type="button"
                  onClick={fillRequiredCollateral}
                  disabled={requiredCollateral === undefined}
                  className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary hover:opacity-80 px-2 disabled:opacity-30"
                >
                  Use min
                </button>
              </div>
              <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.2em] text-base-content/40">
                Wallet:{" "}
                <span className="tabular-nums text-base-content/70">
                  {collateralBalance !== undefined ? `${formatToken(collateralBalance)} ${collateralSymbol}` : "—"}
                </span>
              </div>
              {ctx.user && collateralBalance === 0n && (
                <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.2em] text-warning">
                  No {collateralSymbol}.{" "}
                  <Link href="/" className="underline hover:opacity-80">
                    Mint from the dashboard faucet
                  </Link>
                  .
                </div>
              )}
            </Field>
            <div className="md:col-span-2">
              {!ctx.user ? (
                <button className="btn btn-primary w-full font-mono uppercase tracking-[0.2em] text-xs" disabled>
                  Connect wallet
                </button>
              ) : isSamePair ? (
                <button className="btn btn-warning w-full font-mono uppercase tracking-[0.2em] text-xs" disabled>
                  Pick different borrow / collateral tokens
                </button>
              ) : noPair ? (
                <button className="btn btn-warning w-full font-mono uppercase tracking-[0.2em] text-xs" disabled>
                  No lender accepts this pair
                </button>
              ) : insufficientLiquidity ? (
                <button className="btn btn-warning w-full font-mono uppercase tracking-[0.2em] text-xs" disabled>
                  Insufficient pool liquidity
                </button>
              ) : insufficientCollateralBal ? (
                <button className="btn btn-warning w-full font-mono uppercase tracking-[0.2em] text-xs" disabled>
                  Insufficient {collateralSymbol} balance
                </button>
              ) : undercollateralized ? (
                <button className="btn btn-warning w-full font-mono uppercase tracking-[0.2em] text-xs" disabled>
                  Collateral below required minimum
                </button>
              ) : needsCollateralApproval ? (
                <button
                  className="btn btn-primary w-full font-mono uppercase tracking-[0.2em] text-xs"
                  disabled={!parsedCollateral || isApproving}
                  onClick={onApproveCollateral}
                >
                  {isApproving ? "Approving…" : `Approve ${collateralSymbol}`}
                </button>
              ) : (
                <button
                  className="btn btn-primary w-full font-mono uppercase tracking-[0.2em] text-xs"
                  disabled={!parsedBorrow || !parsedCollateral || isMining}
                  onClick={onBorrow}
                >
                  {isMining ? "Borrowing…" : "Borrow"}
                </button>
              )}
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
        {!ctx.user ? (
          <EmptyPanel label="Connect your wallet to view loans" />
        ) : totalLoans === undefined ? (
          <EmptyPanel label="Loading..." />
        ) : totalLoans === 0 ? (
          <EmptyPanel label="No loans yet" />
        ) : (
          <MyLoansList ctx={ctx} totalLoans={totalLoans} />
        )}
      </section>
    </div>
  );
};

function MyLoansList({ ctx, totalLoans }: { ctx: MaeveContext; totalLoans: number }) {
  return (
    <div className="flex flex-col">
      <div className="hidden md:grid grid-cols-12 gap-4 pb-3 text-[10px] font-mono uppercase tracking-[0.3em] text-base-content/40 border-b border-white/5">
        <div className="col-span-1">#</div>
        <div className="col-span-2">Borrowed</div>
        <div className="col-span-2">Collateral</div>
        <div className="col-span-3">Owed Now</div>
        <div className="col-span-2">Opened</div>
        <div className="col-span-2 text-right">Action</div>
      </div>
      {Array.from({ length: totalLoans }, (_, i) => (
        <MaybeLoanRow key={i} loanId={BigInt(i)} ctx={ctx} />
      ))}
    </div>
  );
}

function MaybeLoanRow({ loanId, ctx }: { loanId: bigint; ctx: MaeveContext }) {
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
  if (!ctx.user) return null;
  if (loan.borrower.toLowerCase() !== (ctx.user as string).toLowerCase()) return null;

  const borrowConfig: MaeveTokenConfig | undefined = ctx.byAddress.get(loan.borrowToken.toLowerCase());
  const collateralConfig: MaeveTokenConfig | undefined = ctx.byAddress.get(loan.collateralToken.toLowerCase());

  const borrowSymbol = borrowConfig?.symbol ?? loan.borrowToken.slice(0, 6);
  const collateralSymbol = collateralConfig?.symbol ?? loan.collateralToken.slice(0, 6);
  const opened = new Date(Number(loan.borrowTimestamp) * 1000).toLocaleDateString();

  const owedAmount = (owed as bigint | undefined) ?? 0n;
  const allowance = borrowConfig ? ctx.allowance[borrowConfig.contractName] : undefined;
  const balance = borrowConfig ? ctx.balance[borrowConfig.contractName] : undefined;
  const writer = borrowConfig ? ctx.tokenWrites[borrowConfig.contractName] : undefined;

  const insufficientForRepay = balance !== undefined && balance < owedAmount;
  const needsApproval = owedAmount > 0n && (allowance === undefined || allowance < owedAmount);

  const onApprove = async () => {
    if (!writer || !ctx.poolAddress) return;
    try {
      await writer.writeContractAsync({
        functionName: "approve",
        args: [ctx.poolAddress, MAX_UINT256],
      });
    } catch {
      /* toast already surfaced */
    }
  };

  const onRepay = async () => {
    try {
      await ctx.poolWrite.writeContractAsync({
        functionName: "repay",
        args: [loanId],
      });
    } catch {
      /* toast already surfaced */
    }
  };

  const isApproving = writer?.isMining ?? false;
  const isRepaying = ctx.poolWrite.isMining;

  return (
    <div className="grid grid-cols-12 gap-4 py-4 items-center border-b border-white/5 last:border-b-0">
      <div className="col-span-1 font-mono text-base-content/40 text-xs">#{loanId.toString()}</div>
      <div className="col-span-12 md:col-span-2 font-mono">
        <div className="tabular-nums">{formatToken(loan.borrowAmount)}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-base-content/40 mt-0.5">{borrowSymbol}</div>
      </div>
      <div className="col-span-12 md:col-span-2 font-mono">
        <div className="tabular-nums">{formatToken(loan.collateralAmount)}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-base-content/40 mt-0.5">{collateralSymbol}</div>
      </div>
      <div className="col-span-12 md:col-span-3 font-mono text-primary tabular-nums">
        {owed !== undefined ? `${formatToken(owedAmount)} ${borrowSymbol}` : <Skeleton width="6rem" />}
      </div>
      <div className="col-span-12 md:col-span-2 font-mono text-[10px] uppercase tracking-[0.2em] text-base-content/50">
        {opened}
      </div>
      <div className="col-span-12 md:col-span-2 flex justify-end">
        {insufficientForRepay ? (
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-warning">low {borrowSymbol}</span>
        ) : needsApproval ? (
          <button
            className="btn btn-sm btn-primary font-mono uppercase tracking-[0.2em] text-[10px]"
            disabled={isApproving || !writer}
            onClick={onApprove}
          >
            {isApproving ? "…" : "Approve"}
          </button>
        ) : (
          <button
            className="btn btn-sm btn-primary font-mono uppercase tracking-[0.2em] text-[10px]"
            disabled={isRepaying || owedAmount === 0n}
            onClick={onRepay}
          >
            {isRepaying ? "…" : "Repay"}
          </button>
        )}
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
