import { balanceInsights, insightMessages, overallBalance } from "@/lib/insights";
import type { HabitCategory, WheelSpokeOut } from "@/types/api";

const spoke = (category: HabitCategory, percent: number, tracking = true): WheelSpokeOut => ({
  category,
  percent,
  completions: 0,
  target: 0,
  tracking,
});

describe("overallBalance", () => {
  it("averages only tracked pillars", () => {
    expect(overallBalance([spoke("Mind", 80), spoke("Spirit", 60), spoke("Body", 0, false)])).toBe(70);
  });

  it("is null when nothing is tracked", () => {
    expect(overallBalance([spoke("Mind", 0, false)])).toBeNull();
    expect(overallBalance([])).toBeNull();
  });

  it("rounds", () => {
    expect(overallBalance([spoke("Mind", 33.3), spoke("Spirit", 33.4)])).toBe(33);
  });
});

describe("balanceInsights", () => {
  it("names strongest and weakest tracked pillars", () => {
    const i = balanceInsights(
      [spoke("Mind", 78), spoke("Spirit", 65), spoke("Fitness", 84), spoke("Body", 0, false)],
      []
    );
    expect(i.strongest).toBe("Fitness");
    expect(i.weakest).toBe("Spirit");
    expect(i.untracked).toEqual(["Body"]);
  });

  it("names neither with a single tracked pillar or a tie", () => {
    expect(balanceInsights([spoke("Mind", 50)], []).strongest).toBeNull();
    const tie = balanceInsights([spoke("Mind", 50), spoke("Body", 50)], []);
    expect(tie.strongest).toBeNull();
    expect(tie.weakest).toBeNull();
  });

  it("picks the biggest move vs the previous window, ignoring small ones", () => {
    const i = balanceInsights(
      [spoke("Mind", 60), spoke("Spirit", 40), spoke("Body", 52)],
      [spoke("Mind", 58), spoke("Spirit", 55), spoke("Body", 45)]
    );
    expect(i.trend).toEqual({ category: "Spirit", delta: -15 });
  });

  it("ignores pillars that weren't tracked in the previous window", () => {
    const i = balanceInsights([spoke("Mind", 90)], [spoke("Mind", 0, false)]);
    expect(i.trend).toBeNull();
  });
});

describe("insightMessages", () => {
  it("has a fallback message when there's nothing to say", () => {
    expect(insightMessages({ strongest: null, weakest: null, trend: null, untracked: [] }, 28)).toHaveLength(1);
  });

  it("describes up and down trends", () => {
    const up = insightMessages({ strongest: null, weakest: null, trend: { category: "Mind", delta: 12 }, untracked: [] }, 28);
    expect(up[0]).toBe("Mind is up 12 points on the previous 28 days.");
    const down = insightMessages({ strongest: null, weakest: null, trend: { category: "Body", delta: -7 }, untracked: [] }, 28);
    expect(down[0]).toBe("Body is down 7 points on the previous 28 days.");
  });
});
