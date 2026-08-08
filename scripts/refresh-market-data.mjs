import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const outputPath = path.resolve(
  process.env.MARKET_DATA_OUTPUT || "public/market-data.json",
);

const targets = [
  { code: "0056", market: "tse" },
  { code: "00713", market: "tse" },
  { code: "00878", market: "tse" },
  { code: "00687B", market: "otc" },
];

const existing = JSON.parse(await readFile("public/market-data.json", "utf8"));

function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toIsoDate(date, time) {
  if (!/^\d{8}$/.test(date || "")) return new Date().toISOString();
  const safeTime = /^\d{2}:\d{2}:\d{2}$/.test(time || "") ? time : "14:30:00";
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${safeTime}+08:00`;
}

async function fetchQuote(target) {
  const channel = `${target.market}_${target.code}.tw`;
  const url = new URL("https://mis.twse.com.tw/stock/api/getStockInfo.jsp");
  url.searchParams.set("ex_ch", channel);
  url.searchParams.set("json", "1");
  url.searchParams.set("delay", "0");

  const response = await fetch(url, {
    headers: {
      accept: "application/json,text/plain,*/*",
      "user-agent": "Mozilla/5.0 ETF-allocator-market-refresh",
    },
  });

  if (!response.ok) throw new Error(`${target.code}: HTTP ${response.status}`);
  const payload = JSON.parse((await response.text()).trim());
  const quote = payload.msgArray?.[0];
  if (!quote) throw new Error(`${target.code}: missing quote`);

  const price = toNumber(quote.z) ?? toNumber(quote.pz) ?? toNumber(quote.y);
  if (!price) throw new Error(`${target.code}: missing price`);

  return {
    code: target.code,
    name: quote.n,
    price,
    previousPrice: toNumber(quote.y) ?? price,
    updatedAt: toIsoDate(quote.d, quote["%"] || quote.t),
  };
}

const results = await Promise.allSettled(targets.map(fetchQuote));
const quotes = results.map((result, index) => {
  if (result.status === "fulfilled") return result.value;

  const fallback = existing.quotes.find(
    (quote) => quote.code === targets[index].code,
  );
  if (!fallback) throw result.reason;
  console.warn(`使用 ${targets[index].code} 的備援行情：${result.reason.message}`);
  return fallback;
});

const validDates = quotes
  .map((quote) => Date.parse(quote.updatedAt || ""))
  .filter(Number.isFinite);
const updatedAt = validDates.length
  ? new Date(Math.max(...validDates)).toISOString()
  : new Date().toISOString();

await writeFile(
  outputPath,
  `${JSON.stringify({ updatedAt, quotes }, null, 2)}\n`,
  "utf8",
);

console.log(`已更新 ${quotes.length} 檔行情：${outputPath}`);
