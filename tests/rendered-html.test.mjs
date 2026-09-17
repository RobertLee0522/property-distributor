import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

// git does not track empty directories, so a fresh checkout never has
// `app/_sites-preview` on disk even though nothing ever wrote into it.
// Treat "missing" the same as "empty" — either means no leftover preview
// files — but still fail loudly if the directory exists and has content.
async function listDirIfExists(url) {
  try {
    return await readdir(url);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the ETF allocation product", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>配配看｜ETF 財產分配器<\/title>/i);
  assert.match(html, /把每一筆預算/);
  assert.match(html, /0056/);
  assert.match(html, /00713/);
  assert.match(html, /00878/);
  assert.match(html, /00687B/);
  assert.match(html, /每月月領金額/);
  assert.match(html, /新增投資標的/);
  assert.match(html, /總投入金額/);
  assert.match(html, /最近四次配息，拆成每個月看/);
  assert.match(html, /12 個月預估入帳分布/);
  assert.match(html, /近四次合計／每股/);
  assert.match(html, /全部所選標的近四次預估配息加總/);
  assert.ok(
    html.indexOf('<section class="target-section"') <
      html.indexOf('<section class="hero"'),
    "雙向換算應顯示在主視覺之前",
  );
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("each asset row offers manual 張／股 inputs that reverse-derive 投入金額", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /股數（張／股）/);

  for (const code of ["0056", "00713", "00878", "00687B"]) {
    assert.match(
      html,
      new RegExp(`aria-label="${code} 張數" inputMode="numeric" value="\\d+"`),
      `${code} 應該有可輸入的「張數」欄位`,
    );
    assert.match(
      html,
      new RegExp(`aria-label="${code} 股數" inputMode="numeric" value="\\d+"`),
      `${code} 應該有可輸入的「股數」欄位`,
    );
  }

  // 尚未手動輸入前，顯示「依預算平均」；手動輸入張數／股數後的重新計算邏輯
  // （反推投入金額、剩餘預算再分配給其他標的）屬於瀏覽器端 state，已用
  // Playwright 手動驗證過，這裡只鎖住 SSR 初始渲染的標記與結構。
  assert.match(html, /依預算平均<!-- -->共 <!-- -->\d+<!-- --> 股/);
});

function parseMoney(text) {
  const parsed = Number(text.replace(/[^0-9.-]/g, ""));
  assert.ok(Number.isFinite(parsed), `無法解析金額：${text}`);
  return parsed;
}

test("monthly dividend cash flow forecast is internally consistent", async () => {
  const response = await render();
  const html = await response.text();

  // 平均每月現金流卡片（頁首）金額，應與 12 個月現金流月曆的「平均每月」一致。
  const heroAmount = parseMoney(
    html.match(/平均每月現金流<\/span>[\s\S]*?<strong>([^<]+)<\/strong>/)[1],
  );
  const [, annualText, averageText] = html.match(
    /全年預估<\/span><strong>([^<]+)<\/strong><small>平均每月 (?:<!-- -->)?([^<]+)<\/small>/,
  );
  const annualTotal = parseMoney(annualText);
  const calendarAverage = parseMoney(averageText);
  assert.equal(heroAmount, calendarAverage, "頁首與月曆的平均每月現金流應相同");

  // 月曆應顯示 12 個月份，且每月金額加總應等於（在四捨五入誤差內）全年預估總額，
  // 也就是「先加總近四次配息推估的全年金額，再除以 12」，而不是把每檔月息各自除以標的數。
  const monthCards = [
    ...html.matchAll(
      /<article class="[^"]*"><span>(\d+月)<\/span><strong>([^<]+)<\/strong>/g,
    ),
  ];
  assert.equal(monthCards.length, 12, "現金流月曆應顯示 12 個月");
  assert.deepEqual(
    monthCards.map(([, label]) => label),
    Array.from({ length: 12 }, (_, index) => `${index + 1}月`),
  );

  const monthSum = monthCards.reduce(
    (sum, [, , amount]) => sum + parseMoney(amount),
    0,
  );
  assert.ok(
    Math.abs(monthSum - annualTotal) <= 10,
    `12 個月金額加總 (${monthSum}) 應約等於全年預估 (${annualTotal})`,
  );
  assert.ok(
    Math.abs(annualTotal / 12 - calendarAverage) <= 1,
    `全年預估除以 12 (${annualTotal / 12}) 應約等於顯示的平均每月 (${calendarAverage})`,
  );
});

test("real-time price cell renders a 10-day candlestick chart", async () => {
  const response = await render();
  const html = await response.text();

  const charts = [
    ...html.matchAll(/<svg class="candlestick-chart"[\s\S]*?<\/svg>/g),
  ];
  assert.equal(charts.length, 4, "四檔預設標的應各有一組K線圖");

  for (const [chartHtml] of charts) {
    const candles = [
      ...chartHtml.matchAll(/<g class="is-(?:up|down)" title="([^"]+)"/g),
    ];
    assert.equal(candles.length, 10, "每組K線圖應顯示最近 10 個交易日");

    const averageLine = chartHtml.match(
      /<polyline class="candlestick-average-line"[^>]*points="([^"]+)"/,
    );
    assert.ok(averageLine, "K線圖應包含平均價格曲線");
    const points = averageLine[1].trim().split(/\s+/);
    assert.equal(points.length, 10, "平均價格曲線應該有 10 個點，對應每根 K 棒");

    for (const [, title] of candles) {
      // 迴歸測試：SVG 內的 <title> 元素在這個框架的 SSR 下會被清空，
      // 提示文字必須改放在 <g title="..."> 屬性上才會真的送到瀏覽器。
      assert.match(
        title,
        /^\d{4}\/\d{2}\/\d{2}｜開 [\d.]+／高 [\d.]+／低 [\d.]+／收 [\d.]+$/,
        `K棒提示文字格式不正確：${title}`,
      );
    }
  }
});

test("candlestick average line is a cumulative average of closing prices", async () => {
  const response = await render();
  const html = await response.text();

  const chartHtml = html.match(/<svg class="candlestick-chart"[\s\S]*?<\/svg>/)[0];
  const candleMatches = [
    ...chartHtml.matchAll(
      /title="\d{4}\/\d{2}\/\d{2}｜開 ([\d.]+)／高 ([\d.]+)／低 ([\d.]+)／收 ([\d.]+)"/g,
    ),
  ];
  assert.equal(candleMatches.length, 10);
  const candles = candleMatches.map(([, open, high, low, close]) => ({
    open: Number(open),
    high: Number(high),
    low: Number(low),
    close: Number(close),
  }));

  // 平均線的定義：第一天平均＝當天收盤，第二天平均＝前兩天收盤平均，
  // 依此類推的「累計平均收盤價」，不是每天各自的開高低收平均。
  let runningSum = 0;
  const expectedAverages = candles.map((candle, index) => {
    runningSum += candle.close;
    return runningSum / (index + 1);
  });

  const high = Math.max(...candles.map((candle) => candle.high));
  const low = Math.min(...candles.map((candle) => candle.low));
  const span = Math.max(high - low, 0.0001);
  const padding = 3;
  const chartHeight = 32;
  const scaleY = (value) =>
    padding + ((high - value) / span) * (chartHeight - padding * 2);

  const averageLine = chartHtml.match(
    /<polyline class="candlestick-average-line"[^>]*points="([^"]+)"/,
  );
  const points = averageLine[1]
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(",").map(Number));

  points.forEach(([, y], index) => {
    const expectedY = scaleY(expectedAverages[index]);
    assert.ok(
      Math.abs(y - expectedY) < 1e-6,
      `第 ${index + 1} 天平均線應等於累計平均收盤價 ${expectedAverages[index].toFixed(3)}（座標 ${expectedY}），實際卻是 ${y}`,
    );
  });
});

test("trade log lets users record purchases and starts empty", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /你的交易紀錄/);
  assert.match(html, /aria-label="交易紀錄標的"/);
  assert.match(html, /aria-label="交易紀錄買進日期"/);
  assert.match(html, /aria-label="交易紀錄張數"/);
  assert.match(html, /aria-label="交易紀錄股數"/);
  assert.match(html, /aria-label="交易紀錄總成本"/);

  // 表單裡的標的選單應該包含目前投資組合裡的每一檔，才能選來記錄。
  for (const code of ["0056", "00713", "00878", "00687B"]) {
    assert.match(
      html,
      new RegExp(`<option value="${code}"`),
      `交易紀錄標的選單應包含 ${code}`,
    );
  }

  // 尚未新增任何紀錄前顯示空狀態提示，而不是空的表格。
  assert.match(html, /還沒有交易紀錄，新增第一筆看看目前報酬率。/);
  assert.doesNotMatch(html, /<article class="trade-log-row"/);
});

test("cloud sync panel explains the jsonbin.io flow and warns about the Master Key's scope", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /雲端同步（選用）/);
  assert.match(html, /aria-label="雲端同步 Master Key"/);
  assert.match(html, /aria-label="雲端同步 Bin ID"/);
  assert.match(html, /type="password"[^>]*aria-label="雲端同步 Master Key"/);

  // Master Key 是帳號層級的權限，不是只綁定單一 Bin，這個警語必須留著，
  // 不能被之後的重構誤刪。
  assert.match(html, /這組 Master Key 能存取你 jsonbin\.io 帳號底下所有的雲端空間/);

  assert.match(html, />上傳</);
  assert.match(html, />下載</);
});

test("cash flow calendar offers budget vs actual-holdings tabs", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /role="tablist"/);
  assert.match(html, />依預算配置</);
  assert.match(html, />依實際持股</);

  // 預設停在「依預算配置」，這樣沒登記交易紀錄的人打開就看得到東西。
  assert.match(
    html,
    /id="cashflow-tab-budget"[^>]*aria-selected="true"/,
    "預設分頁應該是「依預算配置」",
  );
  assert.match(html, /id="cashflow-tab-actual"[^>]*aria-selected="false"/);

  // 只渲染目前選中的分頁，兩個分頁的月曆不該同時出現。
  const monthGrids = [...html.matchAll(/<div class="cashflow-month-grid"/g)];
  assert.equal(monthGrids.length, 1, "同時只該有一組月曆");
});

test("ex-dividend dates are matched back to the right payment", async () => {
  const { attachExDates } = await import(
    new URL("../scripts/ex-dividend-matching.mjs", import.meta.url).href
  );

  // 取自官方除權息日曆與配息表的真實資料。
  const exIndex = new Map([
    [
      "00919",
      [
        { exDate: "2025/09/16", amount: 0.54 },
        { exDate: "2025/12/16", amount: 0.54 },
        { exDate: "2026/03/17", amount: 0.78 },
        { exDate: "2026/06/16", amount: 1 },
        { exDate: "2026/09/16", amount: 1.1 },
      ],
    ],
    [
      // 月配，連續三次都配 0.38：最容易配錯的情況。
      "00929",
      [
        { exDate: "2026/06/17", amount: 0.26 },
        { exDate: "2026/07/21", amount: 0.38 },
        { exDate: "2026/08/19", amount: 0.38 },
      ],
    ],
  ]);

  assert.deepEqual(
    attachExDates(
      "00919",
      [
        { paymentDate: "2026/10/15", amount: 1.1 },
        { paymentDate: "2026/07/13", amount: 1 },
        { paymentDate: "2026/04/14", amount: 0.78 },
        { paymentDate: "2026/01/13", amount: 0.54 },
      ],
      exIndex,
    ),
    [
      { paymentDate: "2026/10/15", amount: 1.1, exDate: "2026/09/16" },
      { paymentDate: "2026/07/13", amount: 1, exDate: "2026/06/16" },
      { paymentDate: "2026/04/14", amount: 0.78, exDate: "2026/03/17" },
      // 金額同樣是 0.54 的有兩次除息，要挑發放日之前最近的那一次。
      { paymentDate: "2026/01/13", amount: 0.54, exDate: "2025/12/16" },
    ],
  );

  assert.deepEqual(
    attachExDates(
      "00929",
      [
        { paymentDate: "2026/10/16", amount: 0.38 },
        { paymentDate: "2026/09/14", amount: 0.38 },
        { paymentDate: "2026/08/14", amount: 0.38 },
        { paymentDate: "2026/07/13", amount: 0.26 },
      ],
      exIndex,
    ),
    [
      // 10/16 這筆的除息日還沒公告，不能拿 8/19 硬湊（那是 9/14 的）。
      { paymentDate: "2026/10/16", amount: 0.38 },
      { paymentDate: "2026/09/14", amount: 0.38, exDate: "2026/08/19" },
      { paymentDate: "2026/08/14", amount: 0.38, exDate: "2026/07/21" },
      { paymentDate: "2026/07/13", amount: 0.26, exDate: "2026/06/17" },
    ],
  );

  // 上櫃標的不在這份日曆裡，要原封不動回傳，讓前端退回只看發放日。
  const otc = [{ paymentDate: "2026/07/13", amount: 0.262 }];
  assert.deepEqual(attachExDates("00687B", otc, exIndex), otc);
});

test("removes all starter-only preview code", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /ETF ALLOCATOR/);
  assert.match(layout, /配配看｜ETF 財產分配器/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);

  assert.deepEqual(
    await listDirIfExists(new URL("../app/_sites-preview", import.meta.url)),
    [],
  );
  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL(".github/workflows/pages.yml", templateRoot));
});
