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
