import { describe, it, expect } from "vitest";
import {
  combineRiskScores,
  bandForScore,
  escalationTierForCount,
  computeBaseline,
} from "@/lib/fuel-fraud-detection";

describe("combineRiskScores / bandForScore", () => {
  it("maps no findings to normal", () => {
    expect(combineRiskScores([])).toEqual({ combinedScore: 0, band: "normal" });
  });

  it("maps a single low-weight finding to normal or low, never higher", () => {
    // weight 1, full confidence -> risk_score 1 -> ~8 points
    const { combinedScore, band } = combineRiskScores([1]);
    expect(combinedScore).toBeLessThanOrEqual(20);
    expect(band).toBe("normal");
  });

  it("maps a single high-severity full-confidence finding (risk_score 3) to the low band", () => {
    const { combinedScore, band } = combineRiskScores([3]);
    expect(combinedScore).toBe(25);
    expect(band).toBe("low");
  });

  it("maps two corroborating high-severity findings to medium", () => {
    const { combinedScore, band } = combineRiskScores([3, 3]);
    expect(combinedScore).toBe(50);
    expect(band).toBe("medium");
  });

  it("maps three corroborating high-severity findings to high", () => {
    const { combinedScore, band } = combineRiskScores([3, 3, 3]);
    expect(combinedScore).toBe(75);
    expect(band).toBe("high");
  });

  it("caps combined score at 100 (critical) regardless of how many findings stack", () => {
    const { combinedScore, band } = combineRiskScores([3, 3, 3, 3, 3, 3]);
    expect(combinedScore).toBe(100);
    expect(band).toBe("critical");
  });

  it("band boundaries are inclusive at the documented cutoffs", () => {
    expect(bandForScore(0)).toBe("normal");
    expect(bandForScore(20)).toBe("normal");
    expect(bandForScore(21)).toBe("low");
    expect(bandForScore(40)).toBe("low");
    expect(bandForScore(41)).toBe("medium");
    expect(bandForScore(60)).toBe("medium");
    expect(bandForScore(61)).toBe("high");
    expect(bandForScore(80)).toBe("high");
    expect(bandForScore(81)).toBe("critical");
    expect(bandForScore(100)).toBe("critical");
  });
});

describe("escalationTierForCount", () => {
  it("classifies a single occurrence as observation", () => {
    expect(escalationTierForCount(1)).toBe("observation");
  });

  it("classifies 2-3 occurrences as warning", () => {
    expect(escalationTierForCount(2)).toBe("warning");
    expect(escalationTierForCount(3)).toBe("warning");
  });

  it("classifies 4-6 occurrences as investigation", () => {
    expect(escalationTierForCount(4)).toBe("investigation");
    expect(escalationTierForCount(6)).toBe("investigation");
  });

  it("classifies 7+ occurrences as a high-risk case", () => {
    expect(escalationTierForCount(7)).toBe("high_risk_case");
    expect(escalationTierForCount(20)).toBe("high_risk_case");
  });

  it("treats zero prior occurrences the same as a first observation", () => {
    expect(escalationTierForCount(0)).toBe("observation");
  });
});

describe("computeBaseline", () => {
  it("refuses to compute a baseline from insufficient history (fewer than 4 samples)", () => {
    expect(computeBaseline([2.5, 2.6, 2.4])).toBeNull();
  });

  it("refuses to guess when there is no history at all", () => {
    expect(computeBaseline([])).toBeNull();
  });

  it("computes mean/stddev/sampleSize once enough history exists", () => {
    const result = computeBaseline([2.5, 2.6, 2.4, 2.5, 2.6]);
    expect(result).not.toBeNull();
    expect(result!.sampleSize).toBe(5);
    expect(result!.mean).toBeCloseTo(2.52, 1);
    expect(result!.stddev).toBeGreaterThanOrEqual(0);
  });

  it("filters out non-positive/invalid readings before checking sample size", () => {
    // Only 3 genuinely positive readings among 6 raw values -> still insufficient.
    expect(computeBaseline([2.5, 0, -1, 2.6, 0, 2.4])).toBeNull();
  });
});
