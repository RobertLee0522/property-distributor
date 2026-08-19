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

const ROC_DATE = /^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/;

function rocToSlashDate(rocDate) {
  const match = ROC_DATE.exec(rocDate || "");
  if (!match) return undefined;
  const [, rocYear, month, day] = match;
  const year = Number(rocYear) + 1911;
  return `${year}/${month.padStart(2, "0")}/${day.padStart(2, "0")}`;
}

function toCandleRows(rows) {
  return rows
    .map((row) => ({
      date: rocToSlashDate(row[0]),
      open: toNumber(row[3]),
      high: toNumber(row[4]),
      low: toNumber(row[5]),
      close: toNumber(row[6]),
    }))
    .filter(
      (candle) =>
        candle.date &&
        [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite),
    );
}

// 上市（TSE）逐月日成交行情，長期穩定的公開端點。
async function fetchTseMonthCandles(code, month) {
  const date = `${month.getFullYear()}${String(month.getMonth() + 1).padStart(2, "0")}01`;
  const url = new URL("https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY");
  url.searchParams.set("date", date);
  url.searchParams.set("stockNo", code);
  url.searchParams.set("response", "json");

  const response = await fetch(url, {
    headers: {
      accept: "application/json,text/plain,*/*",
      "user-agent": "Mozilla/5.0 ETF-allocator-market-refresh",
    },
  });
  if (!response.ok) throw new Error(`${code}: STOCK_DAY HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.stat !== "OK" || !Array.isArray(payload.data)) return [];
  return toCandleRows(payload.data);
}

// 上櫃（OTC/TPEx）逐月日成交行情。TPEx 近年重整過站台，若此端點失效，
// 之後仍會安全退回上一次成功抓到的 K 線（見下方 Promise.allSettled 備援）。
async function fetchOtcMonthCandles(code, month) {
  const rocMonth = `${month.getFullYear() - 1911}/${String(month.getMonth() + 1).padStart(2, "0")}`;
  const url = new URL(
    "https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php",
  );
  url.searchParams.set("l", "zh-tw");
  url.searchParams.set("d", rocMonth);
  url.searchParams.set("stkno", code);

  const response = await fetch(url, {
    headers: {
      accept: "application/json,text/plain,*/*",
      "user-agent": "Mozilla/5.0 ETF-allocator-market-refresh",
    },
  });
  if (!response.ok) throw new Error(`${code}: TPEx HTTP ${response.status}`);
  const payload = await response.json();
  const rows = payload.aaData ?? payload.data;
  if (!Array.isArray(rows)) return [];
  return toCandleRows(rows);
}

async function fetchCandles(target) {
  const fetchMonth =
    target.market === "otc" ? fetchOtcMonthCandles : fetchTseMonthCandles;
  const now = new Date();
  let combined = await fetchMonth(target.code, now);

  if (combined.length < 10) {
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previous = await fetchMonth(target.code, previousMonth);
    combined = [...previous, ...combined];
  }

  const last10 = combined
    .filter(
      (candle, index, all) =>
        all.findIndex((item) => item.date === candle.date) === index,
    )
    .sort(
      (a, b) =>
        Date.parse(a.date.replaceAll("/", "-")) -
        Date.parse(b.date.replaceAll("/", "-")),
    )
    .slice(-10);

  if (last10.length === 0) throw new Error(`${target.code}: no candle history`);
  return last10;
}

const [quoteResults, dividendResults, candleResults] = await Promise.all([
  Promise.allSettled(targets.map(fetchQuote)),
  Promise.allSettled(targets.map(fetchDividends)),
  Promise.allSettled(targets.map(fetchCandles)),
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

  const candleResult = candleResults[index];
  const candles =
    candleResult.status === "fulfilled"
      ? candleResult.value
      : (fallback?.candles ?? []);
  if (candleResult.status === "rejected") {
    console.warn(
      `使用 ${targets[index].code} 的備援K線：${candleResult.reason.message}`,
    );
  }

  return { ...quote, dividends, candles };
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
