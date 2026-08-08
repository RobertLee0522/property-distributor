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
  { code: "0050", market: "tse" },
  { code: "006208", market: "tse" },
  { code: "00919", market: "tse" },
  { code: "00929", market: "tse" },
  { code: "00940", market: "tse" },
  { code: "00679B", market: "otc" },
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

async function fetchDividends(target) {
  const response = await fetch(
    `https://www.twse.com.tw/zh/ETFortune/etfInfo/${target.code}`,
    {
      headers: {
        accept: "text/html,*/*",
        "user-agent": "Mozilla/5.0 ETF-allocator-dividend-refresh",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`${target.code}: dividend HTTP ${response.status}`);
  }

  const html = await response.text();
  const table = html.match(
    /<table\s+class=["']dividend-table["'][^>]*>([\s\S]*?)<\/table>/i,
  )?.[1];
  if (!table) throw new Error(`${target.code}: missing dividend table`);

  const dividends = [...table.matchAll(
    /<tr>\s*<td>\s*(\d{4}\/\d{2}\/\d{2})\s*<\/td>\s*<td>\s*([\d.]+)\s*<\/td>\s*<\/tr>/gi,
  )]
    .map((match) => ({
      paymentDate: match[1],
      amount: toNumber(match[2]),
    }))
    .filter((item) => Number.isFinite(item.amount))
    .slice(0, 4);

  if (dividends.length === 0) {
    throw new Error(`${target.code}: no dividend history`);
  }
  return dividends;
}

const [quoteResults, dividendResults] = await Promise.all([
  Promise.allSettled(targets.map(fetchQuote)),
  Promise.allSettled(targets.map(fetchDividends)),
]);

const quotes = quoteResults.map((result, index) => {
  const fallback = existing.quotes.find(
    (quote) => quote.code === targets[index].code,
  );
  let quote;
  if (result.status === "fulfilled") {
    quote = result.value;
  } else {
    if (!fallback) throw result.reason;
    console.warn(`使用 ${targets[index].code} 的備援行情：${result.reason.message}`);
    quote = fallback;
  }

  const dividendResult = dividendResults[index];
  const dividends =
    dividendResult.status === "fulfilled"
      ? dividendResult.value
      : (fallback?.dividends ?? []);
  if (dividendResult.status === "rejected") {
    console.warn(
      `使用 ${targets[index].code} 的備援配息：${dividendResult.reason.message}`,
    );
  }

  return { ...quote, dividends };
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
