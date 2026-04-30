# CLAUDE.md

@AGENTS.md

This repository keeps agent guidance in `AGENTS.md` to avoid duplication. Please refer to `AGENTS.md` for the full instructions.

---

## Project: Maeve Finance

DeFi lending protocol where **lenders define accepted collateral** (not borrowers / not governance). Built on Scaffold-ETH 2. Hackathon scope, not audited.

See `README.md` for the user-facing description. This file captures the working state and decisions made during the build session, for fast context recovery in future Claude Code sessions.

## Current state (build summary)

Built across nine phases on top of a fresh scaffold-eth-2 clone:

1. **Scaffold + placeholders** — cloned scaffold-eth-2, removed `YourContract.sol`, created empty `MaevePool.sol`/`MockERC20.sol` and matching deploy scripts.
2. **Mocks + data structures** — minimal OZ ERC20 with public `mint`; `MaevePool` storage layout with `Deposit`, `CollateralPreference`, `Loan` structs, mappings, and `Ownable`-gated `addSupportedToken`.
3. **Lender flows** — `deposit`, `setCollateralPreference`, `withdraw`, `getAvailableLiquidity`, `getEffectiveLTV`. Append-only `depositors[]` array per token (no dedupe, leaks gas — flagged).
4. **Borrower flows** — `borrow` + `repay` with simple time-based interest, `getLoanDetails`, `getOutstandingDebt`. 1:1 price assumption (no oracle).
5. **Credit scoring** — `getTokenCreditScore`, `getAllTokenScores`. `addSupportedToken(token)` no-rate overload added; `TokenSupported` event introduced. **Ethers v6 throws "ambiguous function description" on the unqualified `addSupportedToken` shorthand once the overload exists** — all call sites use the explicit `"addSupportedToken(address,uint256)"` / `"addSupportedToken(address)"` selector.
6. **Frontend shell** — IBM Plex Sans/Mono via `next/font`, custom DaisyUI dark palette (deep navy-black + emerald), `MAEVE` mono wordmark. Pages: `/`, `/lend`, `/borrow`, `/scores`.
7. **Reads wired** — added `utils/maeve.ts` (`MAEVE_TOKENS`, formatters, `useMaeveTokens`) and `components/maeve/Skeleton.tsx`. Loan list uses an O(n) scan from 0..nextLoanId with per-row filtering — flagged as `HACKATHON: O(n) loan scan. Real app uses a subgraph or indexed events.`
8. **Writes + faucet** — `useMaeveContext()` hook in `hooks/maeve.ts` instantiates per-token allowance/balance reads + per-token writes + pool write, keyed by contract name (the literal-type workaround). Approve→action flow uses `MAX_UINT256` infinite approve (flagged `HACKATHON: infinite approve for UX speed`). Collateral preference toggles are 500ms-debounced with a `dirty` flag to avoid clobbering the on-chain refetch. Faucet section on dashboard mints 10K of each mock.
9. **AI Risk Agent** — server-side Next.js route at `/api/ai-risk-agent` calling Claude `claude-opus-4-7` with adaptive thinking + JSON-schema-enforced output via `output_config.format`. Falls back to a deterministic rule-based stub when `ANTHROPIC_API_KEY` is unset, returning the same JSON shape (`source: "claude" | "stub"`). Mounted on `/lend` below manual prefs.

Polish pass: `getPairAcceptance` view added (count + avg LTV per pair); `CircularGauge.tsx` SVG ring with red→amber→green color interpolation on `/scores`; "How It Works" cards + count-up animation on dashboard stats; aggregate effect copy + above/below avg LTV indicator on lend pref cards; mobile horizontal-scroll for credit score cards on dashboard; faucet hints on zero balance.

## Anthropic SDK conventions in this repo

- `@anthropic-ai/sdk` is at `latest` (≥ 0.91) — older versions (0.40) lack adaptive thinking and structured outputs.
- Default model: `claude-opus-4-7`.
- Server-side only — `/api/ai-risk-agent/route.ts` is a Next.js API route. **Never call api.anthropic.com from the browser** (CORS + key leak).
- Stub fallback exists so the demo runs without a key. Same JSON shape, deterministic rules. The frontend should never branch on `source` — that field is for telemetry/UI badge only.
- Prompt caching opt-in present on the system block but unlikely to fire (system prompt is ~500 tokens, below the 4096-token minimum cacheable prefix on Opus 4.7).

## Conventions established this session

- **Tokens are configured via a single literal-keyed array** (`MAEVE_TOKENS` in `utils/maeve.ts`). Every per-token read/write hook is instantiated three times in `useMaeveContext()` and dispatched by `contractName`. Don't try to loop `useScaffoldReadContract` calls — the hook needs literal contract names.
- **Loan-list patterns:** `O(n)` client-side scan from `0..nextLoanId`; each row reads `getLoanDetails` + `getOutstandingDebt` and self-filters by borrower/active. Acceptable for the demo, replace with a subgraph for real.
- **Withdraw doesn't need approve** (pool moves its own balance back). Only `deposit`, `borrow` (collateral side), `repay` (borrow-token side) require approve.
- **Repay race:** interest accrues per block, so an exact-amount approval can race the repay tx (saw this in `fullFlow.ts`). The UI uses max-approve; if rebuilding, mirror that pattern.
- **Collateral pref writes are debounced 500ms** with a `dirty` flag pattern: local state syncs from on-chain only when `!dirty`, and the debounced write clears `dirty` on success/failure. Don't refactor the cards to fire on every keystroke — it'll spam txs.
- **Color palette:** primary emerald `#2dd4a8`, base-100 `#0f0f1a`, base-200 `#0a0a0f`, warning `#f59e0b`, error `#ef4444`. Tailwind classes use the DaisyUI semantic names (`text-primary`, `bg-base-100`, etc.) — don't hardcode hex except for inline `style={}` on subtle borders (`rgba(255,255,255,0.06)`).
- **Typography:** `font-mono` for numbers/data/labels (uppercase tracking-[0.2em] for label conventions), `font-light` for headings, `tabular-nums` everywhere a number renders.

## Tricky bits to remember

- **Hardhat per-tx gas cap (16.7M)** is below the default ethers `gasLimit` of 30M (block limit). Direct `contract.method()` calls hit `Transaction gas limit ... exceeds transaction gas cap`. Workarounds in this repo:
  - Deploy scripts use `hre.deployments.execute(...)` which estimates gas correctly.
  - `scripts/fullFlow.ts` passes explicit `{gasLimit: 1_000_000n}` per call.
  - The frontend goes through wagmi which estimates gas correctly.
- **TypeChain overloaded functions** generate signature-keyed methods: must call `pool["addSupportedToken(address,uint256)"](...)` not `pool.addSupportedToken(...)`. Same for `hre.deployments.execute("MaevePool", opts, "addSupportedToken(address,uint256)", ...)`.
- **Token decimals:** all mocks use 18 (flagged shortcut). Real USDC is 6, real WBTC is 8.

## Common workflows

```sh
# Compile + test contracts
cd packages/hardhat && yarn compile && yarn test

# End-to-end exercise of the on-chain path
cd packages/hardhat && yarn hardhat run scripts/fullFlow.ts --network localhost

# Frontend type-check
cd packages/nextjs && yarn check-types

# Reset deployments (after contract changes)
rm -rf packages/hardhat/deployments/localhost && yarn deploy
```

## Files most worth reading first

- `packages/hardhat/contracts/MaevePool.sol` — the protocol, with shortcuts inline.
- `packages/nextjs/utils/maeve.ts` + `packages/nextjs/hooks/maeve.ts` — central frontend wiring.
- `packages/nextjs/app/api/ai-risk-agent/route.ts` — Claude integration + stub.
- `packages/hardhat/scripts/fullFlow.ts` — proves the on-chain path works end-to-end.
