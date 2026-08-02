import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Rate = {
  id: string;
  prefecture: string;
  region: string;
  current: number;
  previous: number;
  increase: number;
  increasePercent: number;
  effective: string;
};

const root = process.cwd();
const index = JSON.parse(readFileSync(resolve(root, "public/data/index.json"), "utf8"));
const rates = JSON.parse(readFileSync(resolve(root, "public/data/rates.json"), "utf8")) as Rate[];
const find = (prefecture: string) => rates.find((item) => item.prefecture === prefecture);

describe("official regional minimum-wage table", () => {
  it("retains verified source metadata and nationwide summary", () => {
    expect(index).toMatchObject({
      asOf: "2026-08-01",
      edition: "2025年度（令和7年度）",
      count: 47,
      regionCount: 9,
      weightedAverage: 1121,
      previousWeightedAverage: 1055,
      weightedIncrease: 66,
      weightedIncreasePercent: 6.3,
      minimum: 1023,
      maximum: 1226,
    });
    expect(index.sourceSha256).toBe(
      "a65722d895c2d69dcf370600d7ec115289e8db9d3355836a08df6c475032c6e2",
    );
  });

  it("contains 47 unique prefectures in nine regions", () => {
    expect(rates).toHaveLength(47);
    expect(new Set(rates.map((item) => item.id)).size).toBe(47);
    expect(new Set(rates.map((item) => item.prefecture)).size).toBe(47);
    expect(new Set(rates.map((item) => item.region)).size).toBe(9);
  });

  it("retains known highest, lowest, and largest-increase rows", () => {
    expect(find("東京都")).toMatchObject({ current: 1226, previous: 1163, increase: 63 });
    expect(find("神奈川県")).toMatchObject({ current: 1225, effective: "2025-10-04" });
    expect(find("熊本県")).toMatchObject({ current: 1034, increase: 82, increasePercent: 8.6 });
    expect(find("高知県")).toMatchObject({ current: 1023, increase: 71 });
    expect(find("宮崎県")).toMatchObject({ current: 1023, effective: "2025-11-16" });
    expect(find("沖縄県")).toMatchObject({ current: 1023, effective: "2025-12-01" });
  });

  it("retains the staggered 2026 effective dates", () => {
    expect(find("秋田県")).toMatchObject({ increase: 80, effective: "2026-03-31" });
    expect(find("群馬県")).toMatchObject({ increase: 78, effective: "2026-03-01" });
    expect(find("福島県")).toMatchObject({ effective: "2026-01-01" });
  });

  it("keeps every official row internally consistent", () => {
    for (const [position, item] of rates.entries()) {
      expect(Object.keys(item).sort()).toEqual([
        "current",
        "effective",
        "id",
        "increase",
        "increasePercent",
        "prefecture",
        "previous",
        "region",
      ]);
      expect(item.id).toBe(`JP-${String(position + 1).padStart(2, "0")}`);
      expect(item.current - item.previous).toBe(item.increase);
      expect(Math.round((item.increase / item.previous) * 1000) / 10).toBe(item.increasePercent);
      expect(item.effective).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    }
    expect(statSync(resolve(root, "public/data/rates.json")).size).toBeLessThan(15000);
  });
});
