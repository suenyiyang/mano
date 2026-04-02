import { describe, expect, it } from "vitest";
import { calculateCreditCost, TIER_CREDITS } from "./credits.js";

describe("calculateCreditCost", () => {
  it("calculates cost with default config", () => {
    const cost = calculateCreditCost(1_000_000, 1_000_000, {});
    // Default: 1 per M input + 4 per M output = 5
    expect(cost).toBe(5);
  });

  it("calculates cost for GPT-4o config", () => {
    const cost = calculateCreditCost(500_000, 200_000, {
      creditsPerMillionInputTokens: 3,
      creditsPerMillionOutputTokens: 10,
    });
    // (500000 * 3 + 200000 * 10) / 1000000 = 1.5 + 2 = 3.5 → ceil = 4
    expect(cost).toBe(4);
  });

  it("calculates cost for Claude Opus config", () => {
    const cost = calculateCreditCost(100_000, 50_000, {
      creditsPerMillionInputTokens: 15,
      creditsPerMillionOutputTokens: 75,
    });
    // (100000 * 15 + 50000 * 75) / 1000000 = 1.5 + 3.75 = 5.25 → ceil = 6
    expect(cost).toBe(6);
  });

  it("returns 0 for zero tokens", () => {
    const cost = calculateCreditCost(0, 0, {
      creditsPerMillionInputTokens: 3,
      creditsPerMillionOutputTokens: 10,
    });
    expect(cost).toBe(0);
  });

  it("ceils fractional credits", () => {
    const cost = calculateCreditCost(1, 1, {
      creditsPerMillionInputTokens: 1,
      creditsPerMillionOutputTokens: 1,
    });
    // (1 + 1) / 1000000 = 0.000002 → ceil = 1
    expect(cost).toBe(1);
  });
});

describe("TIER_CREDITS", () => {
  it("has correct values for all tiers", () => {
    expect(TIER_CREDITS.free).toBe(1_000);
    expect(TIER_CREDITS.pro).toBe(20_000);
    expect(TIER_CREDITS.max).toBe(100_000);
  });
});
