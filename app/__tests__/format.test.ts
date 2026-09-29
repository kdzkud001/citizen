import { CLASS_THRESHOLDS } from "@/constants/classes";
import { todayIso, yesterdayIso } from "@/lib/dates";
import {
  classProgressFraction,
  classRangeLabel,
  formatPoints,
  greeting,
  initials,
  pointsToNextClassLabel,
} from "@/lib/format";

describe("pointsToNextClassLabel", () => {
  it("formats a mid-progression case", () => {
    expect(pointsToNextClassLabel(170, "Outsider")).toBe("170 points to Commoner");
  });

  it("adds thousands separators", () => {
    expect(pointsToNextClassLabel(1041.2, "Noble")).toBe("1,041 points to Elite");
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

describe("greeting", () => {
  const at = (hour: number) => new Date(2026, 8, 29, hour, 0);
  it("switches at noon and 6pm", () => {
    expect(greeting(at(0))).toBe("Good morning");
    expect(greeting(at(11))).toBe("Good morning");
    expect(greeting(at(12))).toBe("Good afternoon");
    expect(greeting(at(17))).toBe("Good afternoon");
    expect(greeting(at(18))).toBe("Good evening");
  });
});

describe("initials", () => {
  it("takes up to two initials", () => {
    expect(initials("kudzi")).toBe("K");
    expect(initials("Kudzi  Kadzi mu")).toBe("KK");
  });
  it("falls back to ? with no name", () => {
    expect(initials(null)).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});

describe("formatPoints", () => {
  it("rounds and adds thousands separators", () => {
    expect(formatPoints(2480.4)).toBe("2,480");
    expect(formatPoints(999.5)).toBe("1,000");
    expect(formatPoints(1234567)).toBe("1,234,567");
    expect(formatPoints(0)).toBe("0");
    expect(formatPoints(-1500)).toBe("-1,500");
  });
});

describe("classRangeLabel", () => {
  it("formats bounded, open-ended and Outsider ranges", () => {
    expect(classRangeLabel(CLASS_THRESHOLDS.Citizen, CLASS_THRESHOLDS.Noble)).toBe("1,000 – 1,999 pts");
    expect(classRangeLabel(CLASS_THRESHOLDS.Elite, null)).toBe("3,500+ pts");
    expect(classRangeLabel(CLASS_THRESHOLDS.Outsider, CLASS_THRESHOLDS.Commoner)).toBe("0 – 299 pts");
  });
});

describe("todayIso / yesterdayIso", () => {
  it("use the UTC date, like the backend", () => {
    const now = new Date("2026-03-01T00:30:00Z");
    expect(todayIso(now)).toBe("2026-03-01");
    expect(yesterdayIso(now)).toBe("2026-02-28");
  });
});
