import { groupByCategory } from "@/lib/habits";
import { radarPoint, radarPolygon } from "@/lib/radar";

describe("radarPoint", () => {
  it("puts spoke 0 straight up", () => {
    const p = radarPoint(0, 5, 100, 100, 150);
    expect(p.x).toBeCloseTo(150);
    expect(p.y).toBeCloseTo(50);
  });

  it("puts value 0 at the center", () => {
    const p = radarPoint(3, 5, 0, 100, 150);
    expect(p.x).toBeCloseTo(150);
    expect(p.y).toBeCloseTo(150);
  });

  it("scales linearly with value", () => {
    const p = radarPoint(0, 4, 50, 100, 0);
    expect(p.y).toBeCloseTo(-50);
  });

  it("goes clockwise: spoke 1 of 4 points right", () => {
    const p = radarPoint(1, 4, 100, 100, 0);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(0);
  });

  it("clamps values outside 0-100", () => {
    expect(radarPoint(0, 4, 150, 100, 0).y).toBeCloseTo(-100);
    expect(radarPoint(0, 4, -20, 100, 0).y).toBeCloseTo(0);
  });
});

describe("radarPolygon", () => {
  it("emits one point per value", () => {
    expect(radarPolygon([100, 100, 100, 100], 10, 0).split(" ")).toHaveLength(4);
  });
});

describe("groupByCategory", () => {
  const h = (id: string, category: "Mind" | "Spirit" | "Body") => ({ id, category });

  it("orders sections by category order and drops empty ones", () => {
    const groups = groupByCategory([h("a", "Body"), h("b", "Mind"), h("c", "Body")]);
    expect(groups.map((g) => g.category)).toEqual(["Mind", "Body"]);
    expect(groups[1].habits.map((x) => x.id)).toEqual(["a", "c"]);
  });

  it("returns nothing for no habits", () => {
    expect(groupByCategory([])).toEqual([]);
  });
});
