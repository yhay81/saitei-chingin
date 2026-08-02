import { readFile } from "node:fs/promises";

const rates = JSON.parse(
  await readFile(new URL("../public/data/rates.json", import.meta.url), "utf8"),
);
const index = JSON.parse(
  await readFile(new URL("../public/data/index.json", import.meta.url), "utf8"),
);
const expectedRegions = [
  "北海道",
  "東北",
  "関東",
  "北陸甲信越",
  "東海",
  "近畿",
  "中国",
  "四国",
  "九州・沖縄",
];

if (rates.length !== 47 || index.count !== rates.length) throw new Error("Expected 47 prefectures");
if (new Set(rates.map((item) => item.id)).size !== rates.length)
  throw new Error("Duplicate prefecture id");
if (new Set(rates.map((item) => item.prefecture)).size !== rates.length)
  throw new Error("Duplicate prefecture name");
for (const [position, item] of rates.entries()) {
  const expectedId = `JP-${String(position + 1).padStart(2, "0")}`;
  if (item.id !== expectedId) throw new Error(`${item.prefecture}: expected ${expectedId}`);
  if (item.current - item.previous !== item.increase)
    throw new Error(`${item.prefecture}: increase mismatch`);
  const percent = Math.round((item.increase / item.previous) * 1000) / 10;
  if (percent !== item.increasePercent)
    throw new Error(`${item.prefecture}: increase percent ${percent} != ${item.increasePercent}`);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(item.effective))
    throw new Error(`${item.prefecture}: invalid effective date`);
  if (!expectedRegions.includes(item.region)) throw new Error(`${item.prefecture}: invalid region`);
}
const regions = [...new Set(rates.map((item) => item.region))];
if (regions.length !== index.regionCount || regions.some((item) => !expectedRegions.includes(item)))
  throw new Error("Region dimensions mismatch");
if (Math.min(...rates.map((item) => item.current)) !== index.minimum)
  throw new Error("Minimum rate mismatch");
if (Math.max(...rates.map((item) => item.current)) !== index.maximum)
  throw new Error("Maximum rate mismatch");
if (!/^[0-9a-f]{64}$/u.test(index.sourceSha256)) throw new Error("Invalid source SHA-256");

console.log(
  JSON.stringify({
    asOf: index.asOf,
    edition: index.edition,
    maximum: index.maximum,
    minimum: index.minimum,
    prefectures: rates.length,
    regions: regions.length,
    weightedAverage: index.weightedAverage,
  }),
);
