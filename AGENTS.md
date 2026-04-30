# AGENTS.md

Guidance for coding agents working in this repository.

## Project Overview

**Maeve Finance** is a DeFi lending protocol where lenders explicitly opt in to which tokens they accept as collateral and at what max LTV. Borrowers see a live aggregate "credit score" per token derived from those preferences. A simulated AI Risk Agent (Claude) recommends per-pair settings based on the lender's risk tolerance.

This is a **hackathon build**: not audited, not production-ready, with shortcuts documented inline. See `README.md` for the user-facing description and the full shortcuts-vs-production table.

The repo is a Yarn workspaces monorepo built on **Scaffold-ETH 2** (Hardhat flavor):

- `packages/hardhat/` — Solidity 0.8.30 + OpenZeppelin 5, hardhat-deploy
- `packages/nextjs/` — Next.js 15 (App Router) + React 19 + Tailwind v4 + DaisyUI 5, wagmi 2 + viem + RainbowKit

## Build summary (current state)

The protocol was built in nine phases plus a polish pass. Today it has:

- **`MaevePool.sol`** — `deposit`, `withdraw`, `setCollateralPreference`, `borrow`, `repay`, plus views: `getEffectiveLTV`, `getPairAcceptance`, `getTokenCreditScore`, `getAllTokenScores`, `getLoanDetails`, `getOutstandingDebt`, `getAvailableLiquidity`. `Ownable`-gated `addSupportedToken` (overloaded: with explicit rate, or no-arg using the default). 26 tests.
- **`MockERC20.sol`** — minimal OZ ERC20 with public `mint`. Three deployments: `MockUSDC`, `MockWETH`, `MockWBTC` (all 18 decimals — flagged shortcut).
- **Frontend** — `/` (dashboard with stats, credit-score cards, How It Works, faucet), `/lend` (deposit + collateral prefs + AI Risk Agent), `/borrow` (open position + my loans), `/scores` (circular-gauge leaderboard).
- **AI Risk Agent** — Next.js API route at `/api/ai-risk-agent` calling Claude `claude-opus-4-7`, with a deterministic stub fallback when `ANTHROPIC_API_KEY` is unset.

## Common Commands

```bash
# Development workflow (run each in a separate terminal)
yarn chain          # Start local hardhat node
yarn deploy         # Deploy MockERC20s + MaevePool to local network
yarn start          # Start Next.js frontend at http://localhost:3000

# Code quality
yarn lint           # Lint both packages
yarn format         # Format both packages
yarn next:check-types
                    # Frontend TypeScript check (run from packages/nextjs)

# Contracts
yarn compile        # Compile Solidity
yarn test           # Run hardhat tests (run from packages/hardhat)

# End-to-end exercise of the on-chain path
cd packages/hardhat && yarn hardhat run scripts/fullFlow.ts --network localhost

# Reset deployments (after contract changes)
rm -rf packages/hardhat/deployments/localhost && yarn deploy

# Deploy to a live network
yarn deploy --network <network>      # e.g., sepolia, base
yarn vercel:yolo --prod              # frontend deployment
```

## Repo Layout

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
    │   ├── scores/page.tsx
    │   └── api/ai-risk-agent/    # Claude proxy + stub
    ├── components/
    │   ├── AiRiskAgent.tsx
    │   └── maeve/
    │       ├── CircularGauge.tsx
    │       └── Skeleton.tsx
    ├── hooks/maeve.ts            # central token+pool reads/writes
    └── utils/maeve.ts            # token config + formatters
```

After `yarn deploy`, ABIs are auto-generated to `packages/nextjs/contracts/deployedContracts.ts`.

## Smart Contract Development

- Contracts: `packages/hardhat/contracts/`
- Deploy scripts: `packages/hardhat/deploy/` (hardhat-deploy plugin)
- Tests: `packages/hardhat/test/`
- Config: `packages/hardhat/hardhat.config.ts`
- Deploy a specific contract via tags: `yarn deploy --tags MaevePool`
- **Manual post-deploy calls** (e.g. `transferOwnership`, `grantRole`, `initialize`) can silently inherit `blockGasLimit` (30M) as their gas cap, which exceeds the localhost per-tx cap (~16.7M) and fails. **Fix at the call site, not in `hardhat.config.ts`:**

  ```typescript
  // Preferred: estimateGas + 20% margin
  const gas = await myContract.myMethod.estimateGas(arg1, arg2);
  await myContract.myMethod(arg1, arg2, { gasLimit: (gas * 120n) / 100n });

  // Or: explicit limit for simple admin calls
  await myContract.transferOwnership(newOwner, { gasLimit: 100_000 });
  ```

  This repo's deploy scripts use `hre.deployments.execute(...)` (which estimates correctly), and `scripts/fullFlow.ts` passes explicit `{gasLimit: 1_000_000n}` per call.

- **TypeChain overloaded functions** generate signature-keyed methods. After we added the `addSupportedToken(address)` overload, the unqualified `pool.addSupportedToken(...)` shorthand started throwing "ambiguous function description" in ethers v6. Use the explicit selector:

  ```typescript
  await pool["addSupportedToken(address,uint256)"](token, rate);
  await pool["addSupportedToken(address)"](token);

  // Same in deploy scripts:
  await execute("MaevePool", opts, "addSupportedToken(address,uint256)", token, rate);
  ```

## Frontend Contract Interaction

Always use the Scaffold-ETH hooks in `packages/nextjs/hooks/scaffold-eth/` for contract reads and writes:

- `useScaffoldReadContract` — read view/pure functions
- `useScaffoldWriteContract` — write to non-payable / payable functions
- `useScaffoldEventHistory`, `useScaffoldWatchContractEvent`, `useDeployedContractInfo`, `useScaffoldContract`, `useTransactor` — other surfaces

These hooks need a **literal contract name**, so dynamic dispatch (looping over a list of tokens) doesn't work directly. The pattern in this repo is `useMaeveContext()` in `hooks/maeve.ts`: it instantiates the per-token reads/writes for `MockUSDC` / `MockWETH` / `MockWBTC` once, then exposes them as a `Record<contractName, ...>` for callers to dispatch by selected symbol. **Don't try to loop `useScaffoldReadContract` calls** — extend `useMaeveContext` instead.

Reading example:

```typescript
const { data: totalDeposited } = useScaffoldReadContract({
  contractName: "MaevePool",
  functionName: "totalDeposited",
  args: [tokenAddress],
});
```

Writing example (note `useTransactor` surfaces toasts automatically — don't reimplement):

```typescript
const { writeContractAsync, isMining } = useScaffoldWriteContract({
  contractName: "MaevePool",
});

await writeContractAsync({
  functionName: "deposit",
  args: [tokenAddress, amount],
});
```

Contract address/ABI data is read from two files in `packages/nextjs/contracts/`:

- `deployedContracts.ts` — auto-generated from deployments
- `externalContracts.ts` — manually added external contracts

## Anthropic SDK conventions

- `@anthropic-ai/sdk` is at `latest` (≥ 0.91) — older versions (0.40) lack adaptive thinking and structured outputs.
- Default model: `claude-opus-4-7`.
- **Server-side only** — `/api/ai-risk-agent/route.ts` is a Next.js API route. **Never call `api.anthropic.com` from the browser** (CORS + key leak).
- Stub fallback exists so the demo runs without a key. Same JSON shape, deterministic rules. The frontend should never branch on `source` — that field is for telemetry/UI badge only.
- Prompt caching opt-in is present on the system block but unlikely to fire (the system prompt is ~500 tokens, below the 4096-token minimum cacheable prefix on Opus 4.7).
- To enable live Claude: `echo 'ANTHROPIC_API_KEY=sk-ant-...' > packages/nextjs/.env.local && yarn start`.

## UI Components

- `@scaffold-ui/components` provides `Address`, `AddressInput`, `Balance`, `EtherInput`, `IntegerInput`. Use these for web3-flavored inputs and displays rather than rolling your own.
- Notifications: `notification.{success,error,warning,info,loading}` from `~~/utils/scaffold-eth`. Use `getParsedError` for human-readable error messages.
- `useTransactor` (already wrapped inside `useScaffoldWriteContract`) surfaces tx-pending and tx-confirmed toasts automatically — don't reimplement.

## Styling

Use DaisyUI semantic classes for components, with the custom Maeve dark palette already wired into `packages/nextjs/styles/globals.css`.

```tsx
// ✅ Good — DaisyUI semantic classes
<button className="btn btn-primary">Deposit</button>
<div className="maeve-card p-6">…</div>

// ❌ Avoid — raw Tailwind when DaisyUI has a component
<button className="px-4 py-2 bg-blue-500 text-white rounded">Deposit</button>
```

Conventions established in this repo:

- **Color palette:** primary emerald `#2dd4a8`, base-100 `#0f0f1a`, base-200 `#0a0a0f`, warning `#f59e0b`, error `#ef4444`. Use the DaisyUI semantic names (`text-primary`, `bg-base-100`, etc.) — don't hardcode hex except for inline `style={}` on subtle borders (`rgba(255,255,255,0.06)` is the convention).
- **Typography:** `font-mono` for numbers/data/labels (uppercase `tracking-[0.2em]` for label conventions), `font-light` for headings, `tabular-nums` everywhere a number renders.
- **Reusable utility classes** (defined in `globals.css`): `maeve-card`, `maeve-card-hover`, `maeve-divider`, `maeve-input`, `maeve-stagger`, `tabular-nums`.

## Conventions established this session

- **Tokens are configured via a single literal-keyed array** (`MAEVE_TOKENS` in `utils/maeve.ts`). Every per-token read/write hook is instantiated three times in `useMaeveContext()` and dispatched by `contractName`.
- **Loan list:** O(n) client-side scan from `0..nextLoanId`; each row reads `getLoanDetails` + `getOutstandingDebt` and self-filters by borrower/active. Acceptable for the demo, replace with a subgraph for real.
- **Withdraw doesn't need approve** (the pool moves its own balance back). Only `deposit`, `borrow` (collateral side), and `repay` (borrow-token side) need the approve→action two-step.
- **Repay race:** interest accrues per block, so an exact-amount approval can race the repay tx (saw this in `fullFlow.ts`). The UI uses max-approve (`MAX_UINT256`); if rebuilding, mirror that pattern.
- **Collateral pref writes are debounced 500ms** with a `dirty` flag pattern: local state syncs from on-chain only when `!dirty`, and the debounced write clears `dirty` on success/failure. Don't refactor the cards to fire on every keystroke — it'll spam txs.
- **Token decimals:** all mocks use 18 (flagged shortcut). Real USDC is 6, real WBTC is 8.

## Code Style

### Identifiers

| Style            | Category                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `UpperCamelCase` | class / interface / type / enum / decorator / type parameters / component functions in TSX / JSXElement type parameter |
| `lowerCamelCase` | variable / parameter / function / property / module alias                                                              |
| `CONSTANT_CASE`  | constant / enum / global variables                                                                                     |
| `snake_case`     | hardhat deploy files                                                                                                   |

### Import paths

Use the `~~` path alias for imports in the nextjs package:

```tsx
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
```

### Pages

```tsx
import type { NextPage } from "next";

const Lend: NextPage = () => {
  return <div>…</div>;
};

export default Lend;
```

### TypeScript

- Use `type` over `interface` for custom types
- Types use `UpperCamelCase` without `T` prefix (use `Address`, not `TAddress`)
- Avoid explicit typing when TypeScript can infer

### Comments

Comments should add information. Avoid redundant JSDoc for simple functions. Inline `SHORTCUT:` and `HACKATHON:` markers flag deliberate compromises — grep for them when reviewing.

## Configuring target networks

- **Hardhat:** Add networks in `packages/hardhat/hardhat.config.ts` if not present.
- **Next.js:** Add networks in `packages/nextjs/scaffold.config.ts` if not present. This file also contains polling-interval and API-key configuration. Decrease the polling interval for L2 chains.

## Files most worth reading first

- `packages/hardhat/contracts/MaevePool.sol` — the protocol, with shortcuts inline
- `packages/nextjs/utils/maeve.ts` + `packages/nextjs/hooks/maeve.ts` — central frontend wiring
- `packages/nextjs/app/api/ai-risk-agent/route.ts` — Claude integration + stub
- `packages/hardhat/scripts/fullFlow.ts` — proves the on-chain path works end-to-end
- `README.md` — user-facing description, architecture diagram, shortcuts vs. production
