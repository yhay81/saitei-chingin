import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import app from "../src/worker";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const worker = read("src/worker.tsx");
const client = read("public/app.js");
const css = read("public/styles.css");
const migration = read("migrations/0001_telemetry.sql");
const surface = `${worker}\n${client}`;
const bindings = {
  ASSETS: {} as Fetcher,
  DB: {
    prepare: () => ({
      bind: () => ({ run: async () => ({ success: true }) }),
      first: async () => ({ ok: 1 }),
    }),
  } as unknown as D1Database,
};

describe("product surface", () => {
  it("communicates through a time clock, pay ticket, and wage scale", () => {
    expect(worker).toContain('class="wage-instrument"');
    expect(worker).toContain('class="clock-face"');
    expect(worker).toContain('class="pay-ticket"');
    expect(client).toContain('class="wage-bar"');
    expect(client).toContain("previous-marker");
    expect(css.toLowerCase()).not.toContain("gradient");
  });

  it("keeps search, hours, and four public ids in the browser", () => {
    expect(worker).toContain('app.post("/api/telemetry"');
    expect(worker).not.toContain('app.post("/api/search"');
    expect(client).toContain('fetch("/data/rates.json")');
    expect(client).toContain("localStorage");
    expect(client).toContain("MAX_COMPARE = 4");
    expect(client).toContain("slice(0, MAX_COMPARE)");
    expect(client).toContain("rate * hours");
    expect(migration).not.toMatch(
      /prefecture_(?:name|id|value)|query_(?:text|value)|search_term|hours_value|email|phone/iu,
    );
  });

  it("states legal and calculation boundaries", () => {
    expect(worker).toContain("参考額は、単純な掛け算です");
    expect(worker).toContain("月給が最低賃金以上かを判定する計算ではありません");
    expect(worker).toContain("派遣先の事業場");
    expect(worker).toContain("高い方の最低賃金が適用されます");
    expect(worker).toContain("公共データ利用規約 第1.0版");
    expect(worker).toContain("https://www.mhlw.go.jp/content/11200000/001571192.pdf");
  });

  it("renders four indexable pages with constrained typography and no meta copy", async () => {
    for (const path of ["/", "/guide", "/source", "/privacy"]) {
      const response = await app.request(
        `https://saitei-chingin.yhay81.com${path}`,
        undefined,
        bindings,
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('<html lang="ja">');
    }
    expect(css).toContain("2.5rem");
    expect(css).not.toMatch(/font-size:\s*(?:[4-9]|\d{2,})rem/iu);
    expect(surface).not.toMatch(
      /public validation|success criteria|experiment|仮説|成功条件|市場スコア|移行候補|収益性/iu,
    );
  });

  it("accepts only same-origin allowlisted telemetry", async () => {
    const accepted = await app.request(
      "https://saitei-chingin.yhay81.com/api/telemetry",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://saitei-chingin.yhay81.com",
          "x-saitei-chingin-session": "12345678-1234-4123-8123-123456789abc",
          "x-saitei-chingin-qa": "1",
        },
        body: JSON.stringify({ name: "visited" }),
      },
      bindings,
    );
    const invalid = await app.request(
      "https://saitei-chingin.yhay81.com/api/telemetry",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "unknown" }),
      },
      bindings,
    );
    const foreign = await app.request(
      "https://saitei-chingin.yhay81.com/api/telemetry",
      {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://example.com" },
        body: JSON.stringify({ name: "visited" }),
      },
      bindings,
    );
    expect(accepted.status).toBe(202);
    expect(invalid.status).toBe(400);
    expect(foreign.status).toBe(403);
  });

  it("separates QA, honors privacy signals, and needs no account", () => {
    expect(client).toContain("navigator.webdriver");
    expect(client).toContain("navigator.doNotTrack");
    expect(client).toContain("globalPrivacyControl");
    expect(client).toContain('"x-saitei-chingin-qa"');
    expect(migration).toContain("is_qa");
    expect(surface).not.toMatch(/better-auth|betterAuth/iu);
  });
});
