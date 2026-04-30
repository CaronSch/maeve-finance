# Maeve Finance

> Lending where lenders set the rules.

Maeve Finance is a DeFi lending protocol built on Scaffold-ETH 2 that inverts the
typical model: **lenders explicitly opt in to which tokens they accept as
collateral** and at what max LTV. Borrowers see a live, aggregated **credit
score** for each token derived from those preferences, and can only borrow on
terms a sufficient cohort of lenders has signed off on.

A simulated **AI Risk Agent** (Claude Opus 4.7) recommends per-pair settings
for a lender based on their declared risk tolerance — and applies them with one
click via on-chain `setCollateralPreference` calls.

This is a **hackathon build**: not audited, not production-ready, with shortcuts
documented inline. See "Shortcuts vs. production" below.

---

## The lender-defined collateral mechanic

Aave / Compound have a single collateral list set by governance — every lender
in the same pool implicitly accepts the same set of collateral tokens at the
same LTV.

Maeve flips that. Each lender, after depositing, sets a `CollateralPreference`
per (depositToken, collateralToken) pair: a max LTV in basis points and an
active flag. The protocol-effective LTV for a (depositToken, collateralToken)
pair is the average across all currently-active lenders in that pool:

```
effectiveLTV(deposit, collateral) =
  average(maxLTV) across lenders L where:
    deposits[deposit][L].amount > 0
    AND collateralPrefs[deposit][L][collateral].active == true
```

When a borrower opens a loan, that effective LTV determines the minimum
collateral they must post. If no lender accepts the (deposit, collateral) pair,
the borrow reverts with `no lender accepts collateral`. Lenders can toggle a
preference off without withdrawing — the next borrower's effective LTV reflects
the change immediately.

The `getTokenCreditScore(token)` view aggregates further: across every deposit
pool, how many lenders accept `token` as collateral and what's the average
LTV they're offering. Higher score = more trusted.

---

## Architecture

```
                ┌─────────────────────────────────────────┐
                │              Maeve Finance              │
                └─────────────────────────────────────────┘

      ┌──────────────┐                          ┌──────────────┐
      │    LENDER    │                          │   BORROWER   │
      └──────┬───────┘                          └──────┬───────┘
             │                                         │
   deposit(token, amount)              borrow(borrowToken, amount,
   setCollateralPreference(                  collateralToken, collAmount)
     deposit, collateral, ltv, active)
             │                                         │
             ▼                                         ▼
   ┌────────────────────────────────────────────────────────────┐
   │                       MaevePool.sol                         │
   │                                                             │
   │   deposits[token][lender]      collateralPrefs[deposit]     │
   │   totalDeposited[token]          [lender][collateral]       │
   │   totalBorrowed[token]         loans[loanId]                │
   │   depositors[token][]          interestRateBps[token]       │
   │                                                             │
   │   ┌──────────────────────────────────────────────────────┐  │
   │   │ getEffectiveLTV(borrow, coll)                        │  │
   │   │   → avg max LTV across lenders accepting coll        │  │
   │   │ getPairAcceptance(borrow, coll) → (avgLtv, count)    │  │
   │   │ getTokenCreditScore(token) → (avgLtv, count) across  │  │
   │   │   ALL deposit pools                                  │  │
   │   └──────────────────────────────────────────────────────┘  │
   └─────────────────────────────────────────────────────────────┘
                                ▲
                                │ POST /api/ai-risk-agent
                                │
                  ┌─────────────┴──────────────┐
                  │       AI Risk Agent        │
                  │  Next.js API → Claude      │
                  │  Opus 4.7  (stub fallback  │
                  │   when ANTHROPIC_API_KEY   │
                  │   is unset)                │
                  └────────────────────────────┘
```

**Stack:**
- Solidity 0.8.30 + OpenZeppelin 5 (`Ownable`, `SafeERC20`, `ERC20`)
- Hardhat + hardhat-deploy
- Next.js 15 (App Router) + React 19 + Tailwind v4 + DaisyUI 5
- wagmi 2 + viem + RainbowKit
- `@anthropic-ai/sdk` for the risk agent (server-side)

---

## Setup

```sh
git clone <this repo>
cd maeve-finance
yarn install
```

Three terminal panes:

```sh
# Terminal 1 — local hardhat node
yarn chain

# Terminal 2 — deploy MockERC20 mocks + MaevePool
yarn deploy

# Terminal 3 — Next.js dev server
yarn start
```

Then open http://localhost:3000.

To enable the live Claude risk agent (instead of the deterministic stub):

```sh
echo 'ANTHROPIC_API_KEY=sk-ant-...' > packages/nextjs/.env.local
# restart yarn start
```

Without the key, the `/api/ai-risk-agent` route serves a hand-rolled stub that
returns the same JSON shape, so the demo flow works end-to-end.

---

## Demo flow

1. Connect a wallet (the burner connector works fine on `localhost:8545`).
2. Visit the **Dashboard** → use the faucet to mint mUSDC, mWETH, mWBTC.
3. Visit `/lend`:
   - Deposit some mUSDC.
   - Either set collateral prefs manually, or click "Analyze & Recommend" in
     the AI Risk Agent and apply.
4. Switch to a second wallet, mint mWETH on the dashboard.
5. Visit `/borrow` and borrow mUSDC against mWETH collateral. The "Effective
   LTV" panel updates live as lenders change preferences.
6. Repay (approve enough mUSDC to cover principal + accrued interest, then
   click Repay).
7. Visit `/scores` to see token credit scores rendered as circular gauges.

There's also a scripted end-to-end check:

```sh
cd packages/hardhat
yarn hardhat run scripts/fullFlow.ts --network localhost
```

It mints, deposits, sets a pref, borrows, repays, withdraws — exercising the
exact same on-chain path the UI uses.

---

## Repo layout

```
packages/
├── hardhat/
│   ├── contracts/
│   │   ├── MaevePool.sol         # core protocol
│   │   └── MockERC20.sol         # mock tokens (mUSDC, mWETH, mWBTC)
│   ├── deploy/
│   │   ├── 01_deploy_mocks.ts
│   │   └── 02_deploy_maeve.ts
│   ├── test/MaevePool.ts         # 26 tests
│   └── scripts/fullFlow.ts       # scripted end-to-end exercise
└── nextjs/
    ├── app/
    │   ├── page.tsx              # dashboard
    │   ├── lend/page.tsx
    │   ├── borrow/page.tsx
    │   ├── scores/page.tsx       # circular-gauge leaderboard
    │   └── api/ai-risk-agent/    # Claude proxy + stub
    ├── components/
    │   ├── AiRiskAgent.tsx
    │   └── maeve/
    │       ├── CircularGauge.tsx
    │       └── Skeleton.tsx
    ├── hooks/maeve.ts            # central token+pool reads/writes
    └── utils/maeve.ts            # token config + formatters
```

---

## Shortcuts vs. production

The contract and the frontend take deliberate shortcuts that a production
protocol would address:

| Shortcut | Where | What production needs |
|---|---|---|
| 1:1 price assumption | `MaevePool.borrow` | Chainlink/Pyth oracle for cross-asset LTV calculation |
| Flat per-token interest rate | `interestRateBps` | Utilization curve (Aave-style) |
| Simple counters, not share tokens | `totalDeposited`, `deposits` | Share token / ray-math accumulator |
| `O(n)` depositor scan in views | `getEffectiveLTV`, `getTokenCreditScore`, `getPairAcceptance` | Aggregated index updated on `setCollateralPreference`, or off-chain via subgraph |
| Unweighted LTV averages | Same | Deposit-weighted average so a whale's preference matters more |
| Append-only `depositors[]` array | `MaevePool.deposit` | EnumerableSet, or remove the iteration entirely via shares |
| Interest accrued only on repay; not routed to lenders | `MaevePool.repay` | Per-block accrual + proportional distribution to active lenders |
| Full-repay only; no partial repayments | `MaevePool.repay` | Partial-repay logic + interest-vs-principal split |
| All mocks 18 decimals | `01_deploy_mocks.ts` | Use real decimals (USDC=6, WBTC=8) and normalize |
| Infinite token approvals | Frontend deposit/borrow flows | Per-amount approvals or ERC-2612 permit |
| O(n) loan scan in My Loans | `borrow/page.tsx` | Subgraph or `Borrowed`/`Repaid` event indexing |
| `nextLoanId` shown as "Active Loans" | Dashboard | Maintain an active counter or scan `loans[].active` |
| AI agent uses hardcoded token profiles | `/api/ai-risk-agent` | On-chain price feeds, historical volatility, real-time liquidity depth |

Every shortcut is also flagged inline in the source — grep for `SHORTCUT` and
`HACKATHON`.

---

## Tests

```sh
cd packages/hardhat
yarn test
```

26 tests across deposit/withdraw, collateral preferences, getAvailableLiquidity,
getEffectiveLTV, borrow/repay (incl. interest accrual at 1yr), credit scoring,
TokenSupported events, and the no-rate `addSupportedToken` overload.

---

## Acknowledgements

Built on [Scaffold-ETH 2](https://scaffoldeth.io/). The hooks (`useScaffoldReadContract`,
`useScaffoldWriteContract`), debug page, deployedContracts.ts code-gen,
RainbowKit integration, and notification system all come from there — a huge
shortcut for a hackathon.
