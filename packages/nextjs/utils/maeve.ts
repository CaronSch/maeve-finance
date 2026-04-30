import { formatUnits } from "viem";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";

// All mocks use 18 decimals — see SHORTCUT comment in 01_deploy_mocks.ts.
export const TOKEN_DECIMALS = 18;

export type MaeveTokenConfig = {
  contractName: "MockUSDC" | "MockWETH" | "MockWBTC";
  symbol: string;
  name: string;
};

export const MAEVE_TOKENS: ReadonlyArray<MaeveTokenConfig> = [
  { contractName: "MockUSDC", symbol: "mUSDC", name: "Mock USDC" },
  { contractName: "MockWETH", symbol: "mWETH", name: "Mock WETH" },
  { contractName: "MockWBTC", symbol: "mWBTC", name: "Mock WBTC" },
];

export type MaeveTokenEntry = {
  config: MaeveTokenConfig;
  address?: `0x${string}`;
};

/**
 * Resolves on-chain addresses for the three mock tokens via scaffold-eth's
 * deployedContracts.ts and returns them paired with display config plus a
 * lowercase-address → config lookup map.
 */
export function useMaeveTokens(): {
  entries: MaeveTokenEntry[];
  byAddress: Map<string, MaeveTokenConfig>;
  ready: boolean;
} {
  const usdc = useDeployedContractInfo({ contractName: "MockUSDC" });
  const weth = useDeployedContractInfo({ contractName: "MockWETH" });
  const wbtc = useDeployedContractInfo({ contractName: "MockWBTC" });

  const entries: MaeveTokenEntry[] = [
    { config: MAEVE_TOKENS[0], address: usdc.data?.address as `0x${string}` | undefined },
    { config: MAEVE_TOKENS[1], address: weth.data?.address as `0x${string}` | undefined },
    { config: MAEVE_TOKENS[2], address: wbtc.data?.address as `0x${string}` | undefined },
  ];

  const byAddress = new Map<string, MaeveTokenConfig>();
  for (const e of entries) {
    if (e.address) byAddress.set(e.address.toLowerCase(), e.config);
  }

  const ready = entries.every(e => !!e.address);
  return { entries, byAddress, ready };
}

/** Format a wei-like bigint with the protocol's 18-decimal assumption. */
export function formatToken(amount: bigint | undefined, fractionDigits = 2): string {
  if (amount === undefined) return "—";
  const num = Number(formatUnits(amount, TOKEN_DECIMALS));
  if (!isFinite(num)) return formatUnits(amount, TOKEN_DECIMALS);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Convert basis points (10000 = 100%) into a "12.34%" display string. */
export function formatBpsAsPercent(bps: bigint | number | undefined, fractionDigits = 2): string {
  if (bps === undefined || bps === null) return "—";
  const n = typeof bps === "bigint" ? Number(bps) : bps;
  return `${(n / 100).toFixed(fractionDigits)}%`;
}

/** Numeric percent (0..100) for bar widths. */
export function bpsToPercentNumber(bps: bigint | number | undefined): number {
  if (bps === undefined || bps === null) return 0;
  const n = typeof bps === "bigint" ? Number(bps) : bps;
  return n / 100;
}
