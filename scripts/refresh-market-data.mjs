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

async function fetchTseCandles(code) {
  const now = new Date();
  let combined = await fetchTseMonthCandles(code, now);

  if (combined.length < 10) {
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previous = await fetchTseMonthCandles(code, previousMonth);
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

  if (last10.length === 0) throw new Error(`${code}: no candle history`);
  return last10;
}

// 上櫃（OTC/TPEx）沒有像 TWSE STOCK_DAY 那種「一次要一整個月、單一標的」的
// 端點：TPEx 目前可用的是「單一交易日、全市場」快照
// （/www/zh-tw/afterTrading/dailyQuotes?date=YYYY/MM/DD&response=json），
// 一次回傳全部約 890 檔上櫃股票／ETF 當天的收盤資訊。所以只能逐日往回抓、
// 從裡面挑出我們要的代號；同一天的快照在同一次執行中用 otcSnapshotCache
// 快取起來，兩檔美債 ETF（00687B、00679B）共用，不必各抓一次。
// 欄位順序（上櫃股票行情表）：
// 0 代號 1 名稱 2 收盤 3 漲跌 4 開盤 5 最高 6 最低 7 均價 8 成交股數 ...
const otcSnapshotCache = new Map();

async function fetchOtcSnapshot(dateStr) {
  if (otcSnapshotCache.has(dateStr)) return otcSnapshotCache.get(dateStr);

  const promise = (async () => {
    const url = `https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?date=${dateStr}&response=json`;
    const response = await fetch(url, {
      headers: {
        accept: "application/json,text/plain,*/*",
        "user-agent": "Mozilla/5.0 ETF-allocator-market-refresh",
      },
    });
    if (!response.ok) throw new Error(`TPEx dailyQuotes HTTP ${response.status}`);
    const payload = await response.json();
    const rows = payload.tables?.[0]?.data;
    const byCode = new Map();
    if (Array.isArray(rows)) {
      for (const row of rows) byCode.set(row[0], row);
    }
    return byCode;
  })();

  otcSnapshotCache.set(dateStr, promise);
  return promise;
}

async function fetchOtcCandles(code) {
  const candles = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - 1); // 從昨天開始，避開還沒收盤定案的當天資料

  for (let daysBack = 0; daysBack < 21 && candles.length < 10; daysBack++) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      const dateStr = `${cursor.getFullYear()}/${String(cursor.getMonth() + 1).padStart(2, "0")}/${String(cursor.getDate()).padStart(2, "0")}`;
      try {
        const snapshot = await fetchOtcSnapshot(dateStr);
        const row = snapshot.get(code);
        if (row) {
          const candle = {
            date: dateStr,
            open: toNumber(row[4]),
            high: toNumber(row[5]),
            low: toNumber(row[6]),
            close: toNumber(row[2]),
          };
          if ([candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)) {
            candles.unshift(candle);
          }
        }
      } catch {
        // 單一天失敗（例如假日、暫時性錯誤）就跳過，繼續往前找。
      }
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  if (candles.length === 0) throw new Error(`${code}: no candle history`);
  return candles.slice(-10);
}

async function fetchCandles(target) {
  return target.market === "otc"
    ? fetchOtcCandles(target.code)
    : fetchTseCandles(target.code);
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
