import { CLASS_THRESHOLDS } from "@/constants/classes";
import { classProgressFraction, pointsToNextClassLabel } from "@/lib/format";

describe("pointsToNextClassLabel", () => {
  it("formats a mid-progression case", () => {
    expect(pointsToNextClassLabel(170, "Outsider")).toBe("170 points to Commoner");
  });

  it("singularizes exactly 1 point", () => {
    expect(pointsToNextClassLabel(1, "Citizen")).toBe("1 point to Noble");
  });

  it("rounds fractional points", () => {
    expect(pointsToNextClassLabel(170.6, "Outsider")).toBe("171 points to Commoner");
  });

  it("reports top class reached when there's no next class threshold", () => {
    expect(pointsToNextClassLabel(null, "Elite")).toBe("Top class reached");
  });

  it("clamps a negative points-to-next (shouldn't happen, but stay sane)", () => {
    expect(pointsToNextClassLabel(-5, "Noble")).toBe("0 points to Elite");
  });
});

describe("classProgressFraction", () => {
  it("is 0 right at the current class's own lower threshold", () => {
    expect(classProgressFraction(300, "Commoner", CLASS_THRESHOLDS)).toBeCloseTo(0);
  });

  it("is 1 right at the next class's threshold", () => {
    expect(classProgressFraction(1000, "Commoner", CLASS_THRESHOLDS)).toBeCloseTo(1);
  });

  it("is 0.5 halfway through the band", () => {
    // Commoner 300 -> Citizen 1000: halfway is 650
    expect(classProgressFraction(650, "Commoner", CLASS_THRESHOLDS)).toBeCloseTo(0.5);
  });

  it("clamps above 1 for a score past the next threshold", () => {
    expect(classProgressFraction(5000, "Commoner", CLASS_THRESHOLDS)).toBe(1);
  });

  it("is always 1 in the top class (Elite has no next threshold)", () => {
    expect(classProgressFraction(10000, "Elite", CLASS_THRESHOLDS)).toBe(1);
  });

  it("Outsider's own threshold is -Infinity: 0 at score 0, not NaN", () => {
    // regression test: naive (score - lower) / (upper - lower) divides
    // Infinity by Infinity here and produces NaN.
    expect(classProgressFraction(0, "Outsider", CLASS_THRESHOLDS)).toBe(0);
    expect(classProgressFraction(150, "Outsider", CLASS_THRESHOLDS)).toBeCloseTo(0.5);
    expect(classProgressFraction(300, "Outsider", CLASS_THRESHOLDS)).toBeCloseTo(1);
  });
});
