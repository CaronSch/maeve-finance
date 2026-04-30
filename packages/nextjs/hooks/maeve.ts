"use client";

import { useAccount } from "wagmi";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";
import { useMaeveTokens } from "~~/utils/maeve";

/**
 * Central hub for token + pool reads and writes.
 *
 * scaffold-eth's hooks need a literal `contractName` so we can't loop over
 * MAEVE_TOKENS dynamically. Instead we instantiate one read/write per known
 * mock token here and expose them through symbol-keyed maps so callers can
 * dispatch by selected token.
 */
export function useMaeveContext() {
  const { address: user } = useAccount();
  const { entries, byAddress, ready: tokensReady } = useMaeveTokens();
  const { data: poolInfo } = useDeployedContractInfo({ contractName: "MaevePool" });
  const poolAddress = poolInfo?.address as `0x${string}` | undefined;

  // --- Per-token reads (allowance vs pool, balance) ---
  const usdcAllowance = useScaffoldReadContract({
    contractName: "MockUSDC",
    functionName: "allowance",
    args: [user, poolAddress],
  });
  const wethAllowance = useScaffoldReadContract({
    contractName: "MockWETH",
    functionName: "allowance",
    args: [user, poolAddress],
  });
  const wbtcAllowance = useScaffoldReadContract({
    contractName: "MockWBTC",
    functionName: "allowance",
    args: [user, poolAddress],
  });

  const usdcBalance = useScaffoldReadContract({
    contractName: "MockUSDC",
    functionName: "balanceOf",
    args: [user],
  });
  const wethBalance = useScaffoldReadContract({
    contractName: "MockWETH",
    functionName: "balanceOf",
    args: [user],
  });
  const wbtcBalance = useScaffoldReadContract({
    contractName: "MockWBTC",
    functionName: "balanceOf",
    args: [user],
  });

  // --- Writes ---
  const usdcWrite = useScaffoldWriteContract({ contractName: "MockUSDC" });
  const wethWrite = useScaffoldWriteContract({ contractName: "MockWETH" });
  const wbtcWrite = useScaffoldWriteContract({ contractName: "MockWBTC" });
  const poolWrite = useScaffoldWriteContract({ contractName: "MaevePool" });

  return {
    user,
    poolAddress,
    entries,
    byAddress,
    tokensReady,
    allowance: {
      MockUSDC: usdcAllowance.data as bigint | undefined,
      MockWETH: wethAllowance.data as bigint | undefined,
      MockWBTC: wbtcAllowance.data as bigint | undefined,
    },
    balance: {
      MockUSDC: usdcBalance.data as bigint | undefined,
      MockWETH: wethBalance.data as bigint | undefined,
      MockWBTC: wbtcBalance.data as bigint | undefined,
    },
    tokenWrites: {
      MockUSDC: usdcWrite,
      MockWETH: wethWrite,
      MockWBTC: wbtcWrite,
    },
    poolWrite,
  } as const;
}

export type MaeveContext = ReturnType<typeof useMaeveContext>;
