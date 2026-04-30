import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// HACKATHON DEMO: Simulated AI analysis. Production version would use on-chain
// data feeds, historical volatility, and real-time liquidity depth — fed into
// the agent as tool calls or structured context, not hardcoded token profiles.

export const runtime = "nodejs";

type RiskTolerance = "conservative" | "moderate" | "aggressive";

type IncomingDeposit = { token: string; amount: string };

type RecommendationSetting = {
  token: string;
  ltv: number;
  accept: boolean;
  reasoning: string;
};

type Recommendation = {
  depositToken: string;
  collateralSettings: RecommendationSetting[];
};

type AgentResponse = {
  recommendations: Recommendation[];
  riskSummary: string;
  source: "claude" | "stub";
};

const SUPPORTED_TOKENS = ["mUSDC", "mWETH", "mWBTC"] as const;

const TOKEN_PROFILES: Record<string, string> = {
  mUSDC: "Stablecoin, low volatility, high liquidity",
  mWETH: "Ethereum native, medium volatility, very high liquidity",
  mWBTC: "Bitcoin wrapped, medium volatility, high liquidity",
};

const SYSTEM_PROMPT = `You are Maeve Finance's AI Risk Agent analyzing DeFi collateral risk.
Your job is to recommend which tokens a lender should accept as collateral
and at what LTV ratio (0-90%, in whole percent), based on the lender's
risk tolerance and a set of available collateral tokens.

Available collateral tokens and their profiles:
${Object.entries(TOKEN_PROFILES)
  .map(([s, d]) => `- ${s}: ${d}`)
  .join("\n")}

Risk tolerance guidance:
- conservative: prefer stablecoins, lower LTVs (50-65%), reject high-volatility pairs
- moderate: balanced — accept most pairs at moderate LTVs (65-78%)
- aggressive: accept everything, push LTVs higher (78-90%)

For every (depositToken, collateralToken) pair where the user holds a deposit, return one
collateralSettings entry. Include a one-sentence reasoning per pair.`;

const RESPONSE_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    recommendations: {
      type: "array" as const,
      items: {
        type: "object" as const,
        additionalProperties: false,
        properties: {
          depositToken: { type: "string" as const, enum: [...SUPPORTED_TOKENS] },
          collateralSettings: {
            type: "array" as const,
            items: {
              type: "object" as const,
              additionalProperties: false,
              properties: {
                token: { type: "string" as const, enum: [...SUPPORTED_TOKENS] },
                ltv: { type: "integer" as const },
                accept: { type: "boolean" as const },
                reasoning: { type: "string" as const },
              },
              required: ["token", "ltv", "accept", "reasoning"],
            },
          },
        },
        required: ["depositToken", "collateralSettings"],
      },
    },
    riskSummary: { type: "string" as const },
  },
  required: ["recommendations", "riskSummary"],
};

export async function POST(req: Request) {
  let body: { deposits?: IncomingDeposit[]; riskTolerance?: RiskTolerance };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const deposits = (body.deposits ?? []).filter(d =>
    SUPPORTED_TOKENS.includes(d.token as (typeof SUPPORTED_TOKENS)[number]),
  );
  const riskTolerance: RiskTolerance =
    body.riskTolerance === "conservative" || body.riskTolerance === "aggressive" ? body.riskTolerance : "moderate";

  if (deposits.length === 0) {
    return NextResponse.json({ error: "no deposits to analyze" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Deterministic fallback so the demo works without a key. The shape matches
    // the schema we'd expect from Claude, so the frontend stays one code path.
    return NextResponse.json(stubResponse(deposits, riskTolerance));
  }

  try {
    const client = new Anthropic({ apiKey });
    const userPrompt = buildUserPrompt(deposits, riskTolerance);

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1500,
      thinking: { type: "adaptive" },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          // System block is stable across requests — caching it is cheap and
          // amortizes across users in the rare event the prefix exceeds the
          // model's minimum cache prefix.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
      output_config: {
        format: { type: "json_schema", schema: RESPONSE_SCHEMA },
      },
    });

    const textBlock = response.content.find(b => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "no text in model response" }, { status: 502 });
    }

    let parsed: Omit<AgentResponse, "source">;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      return NextResponse.json({ error: "model returned invalid JSON", raw: textBlock.text }, { status: 502 });
    }

    return NextResponse.json({ ...parsed, source: "claude" } satisfies AgentResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: `anthropic call failed: ${msg}` }, { status: 502 });
  }
}

function buildUserPrompt(deposits: IncomingDeposit[], risk: RiskTolerance) {
  const lines = deposits.map(d => `- ${d.amount} ${d.token}`);
  return `The user has deposited:\n${lines.join("\n")}\n\nTheir risk tolerance: ${risk}\n\nFor each deposit pool, recommend collateral tokens to accept and a max LTV (0-90, integer percent). Reject pairs that violate the risk tolerance with accept=false and ltv=0. Return JSON only.`;
}

function stubResponse(deposits: IncomingDeposit[], risk: RiskTolerance): AgentResponse {
  // Hand-rolled rules used when ANTHROPIC_API_KEY isn't set.
  // Same JSON shape as the live model so the frontend doesn't branch.
  const ltvBy: Record<RiskTolerance, { stable: number; bluechip: number; rejectVolatile: boolean }> = {
    conservative: { stable: 60, bluechip: 55, rejectVolatile: true },
    moderate: { stable: 75, bluechip: 70, rejectVolatile: false },
    aggressive: { stable: 88, bluechip: 85, rejectVolatile: false },
  };
  const cfg = ltvBy[risk];

  const stableSet = new Set(["mUSDC"]);

  const recs: Recommendation[] = deposits.map(d => ({
    depositToken: d.token,
    collateralSettings: SUPPORTED_TOKENS.filter(t => t !== d.token).map(collateral => {
      const isStable = stableSet.has(collateral);
      const accept = !(cfg.rejectVolatile && !isStable);
      const ltv = !accept ? 0 : isStable ? cfg.stable : cfg.bluechip;
      const reasoning = !accept
        ? `${collateral} is too volatile for a conservative risk profile.`
        : isStable
          ? `${collateral} is a stablecoin — minimal price-shock risk against ${d.token}.`
          : `${collateral} has deep liquidity and a stable price floor; ${ltv}% leaves a safety margin against drawdowns.`;
      return { token: collateral, ltv, accept, reasoning };
    }),
  }));

  const summaryByRisk: Record<RiskTolerance, string> = {
    conservative:
      "Stablecoin-only collateral keeps drawdown risk near zero. You won't capture as much borrow demand, but the funds are protected against volatile collateral collapsing in a flash crash.",
    moderate:
      "Accepting blue-chip volatile collateral at moderate LTVs balances yield against tail risk. Rebalance if any single collateral concentration exceeds ~50% of borrows.",
    aggressive:
      "High LTVs across all blue-chips maximize capital efficiency and borrow demand. The trade-off is meaningful tail risk if a 30%+ flash-crash hits the collateral side — accept this exposure consciously.",
  };

  return {
    recommendations: recs,
    riskSummary: summaryByRisk[risk],
    source: "stub",
  };
}
