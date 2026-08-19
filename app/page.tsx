"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type DividendRecord = {
  paymentDate: string;
  amount: number;
};

type Candle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type Asset = {
  code: string;
  market: "tse" | "otc";
  name: string;
  price: number;
  previousPrice: number;
  yieldRate: number;
  yieldMode?: "history" | "manual";
  dividends?: DividendRecord[];
  candles?: Candle[];
  accent: string;
};

type MarketQuote = {
  code: string;
  price: number;
  previousPrice?: number;
  name?: string;
  updatedAt?: string;
  dividends?: DividendRecord[];
  candles?: Candle[];
};

type AssetDraft = {
  code: string;
  market: "tse" | "otc";
  name: string;
  price: string;
  yieldRate: string;
};

const DEFAULT_ASSETS: Asset[] = [
  {
    code: "0056",
    market: "tse",
    name: "元大高股息",
    price: 51.05,
    previousPrice: 51.3,
    yieldRate: 9.2,
    yieldMode: "history",
    dividends: [
      { paymentDate: "2026/08/10", amount: 1.35 },
      { paymentDate: "2026/05/14", amount: 1 },
      { paymentDate: "2026/02/11", amount: 0.866 },
      { paymentDate: "2025/11/14", amount: 0.866 },
    ],
    candles: [
      { date: "2026/08/05", open: 51.71, high: 51.82, low: 51.57, close: 51.61 },
      { date: "2026/08/06", open: 51.63, high: 51.77, low: 51.31, close: 51.45 },
      { date: "2026/08/07", open: 51.34, high: 51.69, low: 51.2, close: 51.52 },
      { date: "2026/08/10", open: 51.52, high: 51.74, low: 51.41, close: 51.67 },
      { date: "2026/08/11", open: 51.57, high: 51.74, low: 51.49, close: 51.73 },
      { date: "2026/08/12", open: 51.84, high: 51.86, low: 51.36, close: 51.49 },
      { date: "2026/08/13", open: 51.55, high: 51.69, low: 51.35, close: 51.5 },
      { date: "2026/08/14", open: 51.42, high: 51.46, low: 51.11, close: 51.21 },
      { date: "2026/08/17", open: 51.22, high: 51.35, low: 51.1, close: 51.3 },
      { date: "2026/08/18", open: 51.33, high: 51.36, low: 51, close: 51.05 },
    ],
    accent: "#5662d9",
  },
  {
    code: "00713",
    market: "tse",
    name: "元大台灣高息低波",
    price: 61.3,
    previousPrice: 61.1,
    yieldRate: 7.8,
    yieldMode: "history",
    dividends: [
      { paymentDate: "2026/07/10", amount: 1 },
      { paymentDate: "2026/04/14", amount: 0.78 },
      { paymentDate: "2026/01/12", amount: 0.78 },
      { paymentDate: "2025/10/15", amount: 0.78 },
    ],
    candles: [
      { date: "2026/08/05", open: 61.72, high: 62.02, low: 61.54, close: 61.8 },
      { date: "2026/08/06", open: 61.85, high: 62.25, low: 61.73, close: 62.06 },
      { date: "2026/08/07", open: 62.09, high: 62.23, low: 61.78, close: 61.93 },
      { date: "2026/08/10", open: 61.88, high: 62.39, low: 61.8, close: 62.2 },
      { date: "2026/08/11", open: 62.06, high: 62.53, low: 61.88, close: 62.42 },
      { date: "2026/08/12", open: 62.34, high: 62.45, low: 62.09, close: 62.13 },
      { date: "2026/08/13", open: 62.09, high: 62.28, low: 61.56, close: 61.76 },
      { date: "2026/08/14", open: 61.82, high: 61.87, low: 61.3, close: 61.45 },
      { date: "2026/08/17", open: 61.48, high: 61.62, low: 60.97, close: 61.1 },
      { date: "2026/08/18", open: 61.14, high: 61.36, low: 60.94, close: 61.3 },
    ],
    accent: "#2d8c73",
  },
  {
    code: "00878",
    market: "tse",
    name: "國泰永續高股息",
    price: 32.81,
    previousPrice: 32.84,
    yieldRate: 8.1,
    yieldMode: "history",
    dividends: [
      { paymentDate: "2026/06/12", amount: 0.66 },
      { paymentDate: "2026/03/23", amount: 0.42 },
      { paymentDate: "2025/12/12", amount: 0.4 },
      { paymentDate: "2025/09/11", amount: 0.4 },
    ],
    candles: [
      { date: "2026/08/05", open: 32.608, high: 32.749, low: 32.527, close: 32.675 },
      { date: "2026/08/06", open: 32.613, high: 32.824, low: 32.566, close: 32.712 },
      { date: "2026/08/07", open: 32.652, high: 32.712, low: 32.564, close: 32.641 },
      { date: "2026/08/10", open: 32.676, high: 32.78, low: 32.561, close: 32.752 },
      { date: "2026/08/11", open: 32.732, high: 32.804, low: 32.674, close: 32.706 },
      { date: "2026/08/12", open: 32.771, high: 32.844, low: 32.68, close: 32.81 },
      { date: "2026/08/13", open: 32.798, high: 32.983, low: 32.723, close: 32.978 },
      { date: "2026/08/14", open: 32.949, high: 33.058, low: 32.908, close: 32.983 },
      { date: "2026/08/17", open: 33.01, high: 33.09, low: 32.766, close: 32.84 },
      { date: "2026/08/18", open: 32.849, high: 32.865, low: 32.789, close: 32.81 },
    ],
    accent: "#d4853d",
  },
  {
    code: "00687B",
    market: "otc",
    name: "國泰20年美債",
    price: 27.49,
    previousPrice: 27.76,
    yieldRate: 4.6,
    yieldMode: "history",
    dividends: [
      { paymentDate: "2026/07/13", amount: 0.262 },
      { paymentDate: "2026/04/14", amount: 0.28 },
      { paymentDate: "2026/01/13", amount: 0.28 },
      { paymentDate: "2025/10/15", amount: 0.3 },
    ],
    candles: [
      { date: "2026/08/05", open: 27.622, high: 27.727, low: 27.612, close: 27.678 },
      { date: "2026/08/06", open: 27.739, high: 27.791, low: 27.656, close: 27.73 },
      { date: "2026/08/07", open: 27.693, high: 27.833, low: 27.67, close: 27.806 },
      { date: "2026/08/10", open: 27.746, high: 27.885, low: 27.652, close: 27.835 },
      { date: "2026/08/11", open: 27.863, high: 27.877, low: 27.765, close: 27.819 },
      { date: "2026/08/12", open: 27.827, high: 27.854, low: 27.645, close: 27.666 },
      { date: "2026/08/13", open: 27.608, high: 27.839, low: 27.565, close: 27.812 },
      { date: "2026/08/14", open: 27.856, high: 27.859, low: 27.844, close: 27.853 },
      { date: "2026/08/17", open: 27.809, high: 27.865, low: 27.709, close: 27.76 },
      { date: "2026/08/18", open: 27.726, high: 27.739, low: 27.477, close: 27.49 },
    ],
    accent: "#c85b68",
  },
];

const SUGGESTED_ASSETS: Asset[] = [
  {
    code: "0050",
    market: "tse",
    name: "元大台灣50",
    price: 102.85,
    previousPrice: 103.3,
    yieldRate: 2.5,
    candles: [
      { date: "2026/08/05", open: 102.6, high: 102.95, low: 102.4, close: 102.49 },
      { date: "2026/08/06", open: 102.72, high: 103.03, low: 102.04, close: 102.05 },
      { date: "2026/08/07", open: 101.83, high: 102.34, low: 101.74, close: 102.29 },
      { date: "2026/08/10", open: 102.15, high: 102.77, low: 101.79, close: 102.42 },
      { date: "2026/08/11", open: 102.65, high: 102.96, low: 102.35, close: 102.96 },
      { date: "2026/08/12", open: 102.74, high: 103.52, low: 102.62, close: 103.19 },
      { date: "2026/08/13", open: 103.33, high: 103.57, low: 102.97, close: 103.09 },
      { date: "2026/08/14", open: 102.89, high: 103.14, low: 102.83, close: 103.11 },
      { date: "2026/08/17", open: 103.17, high: 103.61, low: 102.91, close: 103.3 },
      { date: "2026/08/18", open: 103.34, high: 103.48, low: 102.66, close: 102.85 },
    ],
    accent: "#4377bd",
  },
  {
    code: "006208",
    market: "tse",
    name: "富邦台50",
    price: 235.35,
    previousPrice: 236.55,
    yieldRate: 2.6,
    candles: [
      { date: "2026/08/05", open: 239.36, high: 239.37, low: 238.63, close: 239.26 },
      { date: "2026/08/06", open: 239.47, high: 239.98, low: 238.13, close: 238.73 },
      { date: "2026/08/07", open: 238.72, high: 239.65, low: 238.4, close: 239.01 },
      { date: "2026/08/10", open: 238.81, high: 239.15, low: 237.88, close: 238.39 },
      { date: "2026/08/11", open: 238.93, high: 239.15, low: 238.36, close: 238.42 },
      { date: "2026/08/12", open: 237.99, high: 238.68, low: 237.09, close: 237.8 },
      { date: "2026/08/13", open: 238.18, high: 238.94, low: 236.7, close: 236.73 },
      { date: "2026/08/14", open: 237.04, high: 237.43, low: 235.12, close: 235.61 },
      { date: "2026/08/17", open: 236.02, high: 236.98, low: 235.71, close: 236.55 },
      { date: "2026/08/18", open: 236.68, high: 237.39, low: 235.13, close: 235.35 },
    ],
    accent: "#7b62b3",
  },
  {
    code: "00919",
    market: "tse",
    name: "群益台灣精選高息",
    price: 29.74,
    previousPrice: 29.6,
    yieldRate: 10,
    candles: [
      { date: "2026/08/05", open: 29.821, high: 29.868, low: 29.789, close: 29.794 },
      { date: "2026/08/06", open: 29.839, high: 30.004, low: 29.769, close: 29.902 },
      { date: "2026/08/07", open: 29.852, high: 29.924, low: 29.775, close: 29.797 },
      { date: "2026/08/10", open: 29.795, high: 29.896, low: 29.578, close: 29.641 },
      { date: "2026/08/11", open: 29.656, high: 29.751, low: 29.499, close: 29.533 },
      { date: "2026/08/12", open: 29.506, high: 29.638, low: 29.463, close: 29.585 },
      { date: "2026/08/13", open: 29.587, high: 29.64, low: 29.514, close: 29.533 },
      { date: "2026/08/14", open: 29.505, high: 29.642, low: 29.434, close: 29.575 },
      { date: "2026/08/17", open: 29.509, high: 29.634, low: 29.405, close: 29.6 },
      { date: "2026/08/18", open: 29.666, high: 29.815, low: 29.656, close: 29.74 },
    ],
    accent: "#3997a3",
  },
  {
    code: "00929",
    market: "tse",
    name: "復華台灣科技優息",
    price: 28.59,
    previousPrice: 28.94,
    yieldRate: 6,
    candles: [
      { date: "2026/08/05", open: 29.136, high: 29.184, low: 29.1, close: 29.174 },
      { date: "2026/08/06", open: 29.202, high: 29.299, low: 28.951, close: 29.053 },
      { date: "2026/08/07", open: 29.019, high: 29.106, low: 28.989, close: 29.07 },
      { date: "2026/08/10", open: 29.112, high: 29.172, low: 28.876, close: 28.949 },
      { date: "2026/08/11", open: 28.948, high: 29.003, low: 28.76, close: 28.784 },
      { date: "2026/08/12", open: 28.842, high: 28.869, low: 28.596, close: 28.67 },
      { date: "2026/08/13", open: 28.672, high: 28.759, low: 28.574, close: 28.714 },
      { date: "2026/08/14", open: 28.702, high: 28.94, low: 28.629, close: 28.882 },
      { date: "2026/08/17", open: 28.916, high: 29.039, low: 28.847, close: 28.94 },
      { date: "2026/08/18", open: 28.876, high: 28.932, low: 28.52, close: 28.59 },
    ],
    accent: "#ba6a9c",
  },
  {
    code: "00940",
    market: "tse",
    name: "元大台灣價值高息",
    price: 12.4,
    previousPrice: 12.45,
    yieldRate: 8,
    candles: [
      { date: "2026/08/05", open: 12.558, high: 12.571, low: 12.551, close: 12.558 },
      { date: "2026/08/06", open: 12.54, high: 12.581, low: 12.493, close: 12.496 },
      { date: "2026/08/07", open: 12.524, high: 12.562, low: 12.406, close: 12.429 },
      { date: "2026/08/10", open: 12.437, high: 12.46, low: 12.409, close: 12.455 },
      { date: "2026/08/11", open: 12.434, high: 12.464, low: 12.368, close: 12.399 },
      { date: "2026/08/12", open: 12.403, high: 12.435, low: 12.382, close: 12.433 },
      { date: "2026/08/13", open: 12.409, high: 12.495, low: 12.396, close: 12.473 },
      { date: "2026/08/14", open: 12.447, high: 12.51, low: 12.413, close: 12.467 },
      { date: "2026/08/17", open: 12.481, high: 12.483, low: 12.424, close: 12.45 },
      { date: "2026/08/18", open: 12.446, high: 12.477, low: 12.399, close: 12.4 },
    ],
    accent: "#a37b3b",
  },
  {
    code: "00679B",
    market: "otc",
    name: "元大美債20年",
    price: 26.41,
    previousPrice: 26.66,
    yieldRate: 4.5,
    candles: [
      { date: "2026/08/05", open: 26.881, high: 26.982, low: 26.792, close: 26.89 },
      { date: "2026/08/06", open: 26.86, high: 26.878, low: 26.701, close: 26.759 },
      { date: "2026/08/07", open: 26.762, high: 26.785, low: 26.692, close: 26.772 },
      { date: "2026/08/10", open: 26.711, high: 26.801, low: 26.521, close: 26.616 },
      { date: "2026/08/11", open: 26.654, high: 26.758, low: 26.65, close: 26.736 },
      { date: "2026/08/12", open: 26.752, high: 26.753, low: 26.594, close: 26.661 },
      { date: "2026/08/13", open: 26.667, high: 26.743, low: 26.504, close: 26.515 },
      { date: "2026/08/14", open: 26.516, high: 26.656, low: 26.453, close: 26.622 },
      { date: "2026/08/17", open: 26.565, high: 26.742, low: 26.516, close: 26.66 },
      { date: "2026/08/18", open: 26.707, high: 26.739, low: 26.353, close: 26.41 },
    ],
    accent: "#6f8796",
  },
];

const ASSET_CATALOG = [...DEFAULT_ASSETS, ...SUGGESTED_ASSETS];
const ACCENT_COLORS = [
  "#5662d9",
  "#2d8c73",
  "#d4853d",
  "#c85b68",
  "#4377bd",
  "#7b62b3",
  "#3997a3",
  "#ba6a9c",
  "#a37b3b",
  "#6f8796",
];
const PORTFOLIO_STORAGE_KEY = "peipeikan-portfolio-v1";

const EMPTY_DRAFT: AssetDraft = {
  code: "",
  market: "tse",
  name: "",
  price: "",
  yieldRate: "",
};

const money = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 3 });
const MONTH_LABELS = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);

function parseNumericInput(value: string) {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

function getRecentDividends(asset: Asset) {
  return (asset.dividends ?? []).slice(0, 4);
}

function getRecentCandles(asset: Asset) {
  return (asset.candles ?? []).slice(-10);
}

function getDividendFrequency(asset: Asset) {
  const records = getRecentDividends(asset)
    .map((dividend) => Date.parse(dividend.paymentDate.replaceAll("/", "-")))
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  if (records.length < 2) return records.length;

  const gaps = records
    .slice(0, -1)
    .map((date, index) => (date - records[index + 1]) / 86_400_000)
    .sort((a, b) => a - b);
  const medianGap = gaps[Math.floor(gaps.length / 2)];
  const inferred = 365 / Math.max(medianGap, 1);
  return [1, 2, 4, 6, 12].reduce((closest, candidate) =>
    Math.abs(candidate - inferred) < Math.abs(closest - inferred)
      ? candidate
      : closest,
  );
}

function getAverageDividendPerPayment(asset: Asset) {
  const recentDividends = getRecentDividends(asset);
  if (recentDividends.length === 0) return 0;
  return (
    recentDividends.reduce((sum, dividend) => sum + dividend.amount, 0) /
    recentDividends.length
  );
}

function getAnnualDividendPerShare(asset: Asset) {
  const recentDividends = getRecentDividends(asset);
  if (asset.yieldMode !== "manual" && recentDividends.length > 0) {
    return getAverageDividendPerPayment(asset) * getDividendFrequency(asset);
  }
  return asset.price * (asset.yieldRate / 100);
}

function getForecastPaymentMonths(asset: Asset) {
  const frequency = getDividendFrequency(asset);
  if (frequency >= 10) return MONTH_LABELS.map((_, index) => index);

  const months = getRecentDividends(asset)
    .map((dividend) => Number(dividend.paymentDate.split("/")[1]) - 1)
    .filter((month, index, all) => month >= 0 && all.indexOf(month) === index);
  return months.slice(0, frequency);
}

function getEstimatedYield(asset: Asset) {
  if (asset.price <= 0) return 0;
  return (getAnnualDividendPerShare(asset) / asset.price) * 100;
}

function getAverageYield(assets: Asset[]) {
  if (assets.length === 0) return 0;
  return assets.reduce((sum, asset) => sum + getEstimatedYield(asset), 0) / assets.length;
}

function enrichStoredAsset(asset: Asset) {
  const catalogAsset = ASSET_CATALOG.find((item) => item.code === asset.code);
  const dividends = asset.dividends?.length
    ? asset.dividends
    : (catalogAsset?.dividends ?? []);
  const candles = asset.candles?.length
    ? asset.candles
    : (catalogAsset?.candles ?? []);
  return {
    ...asset,
    dividends,
    candles,
    yieldMode:
      asset.yieldMode ?? (dividends.length > 0 ? "history" : undefined),
  } satisfies Asset;
}

function CandlestickChart({ asset }: { asset: Asset }) {
  const candles = getRecentCandles(asset);
  if (candles.length === 0) return null;

  const barWidth = 6;
  const gap = 4;
  const width = candles.length * (barWidth + gap) - gap;
  const height = 32;
  const padding = 3;
  const high = Math.max(...candles.map((candle) => candle.high));
  const low = Math.min(...candles.map((candle) => candle.low));
  const span = Math.max(high - low, 0.0001);
  const scaleY = (value: number) =>
    padding + ((high - value) / span) * (height - padding * 2);

  return (
    <svg
      className="candlestick-chart"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${asset.code} 近 ${candles.length} 個交易日走勢，開盤 ${candles[0].open} 收盤 ${candles[candles.length - 1].close}`}
    >
      {candles.map((candle, index) => {
        const isUp = candle.close >= candle.open;
        const x = index * (barWidth + gap);
        const bodyTop = scaleY(Math.max(candle.open, candle.close));
        const bodyBottom = scaleY(Math.min(candle.open, candle.close));
        return (
          <g
            key={candle.date}
            className={isUp ? "is-up" : "is-down"}
            title={`${candle.date}｜開 ${candle.open}／高 ${candle.high}／低 ${candle.low}／收 ${candle.close}`}
          >
            <line
              x1={x + barWidth / 2}
              x2={x + barWidth / 2}
              y1={scaleY(candle.high)}
              y2={scaleY(candle.low)}
            />
            <rect
              x={x}
              y={bodyTop}
              width={barWidth}
              height={Math.max(bodyBottom - bodyTop, 1)}
            />
          </g>
        );
      })}
    </svg>
  );
}

export default function Home() {
  const [budget, setBudget] = useState(200000);
  const [monthlyTarget, setMonthlyTarget] = useState(
    (200000 * getAverageYield(DEFAULT_ASSETS)) / 100 / 12,
  );
  const [linkDirection, setLinkDirection] = useState<"capital" | "income">(
    "capital",
  );
  const [unit, setUnit] = useState<1 | 1000>(1);
  const [assets, setAssets] = useState(DEFAULT_ASSETS);
  const [marketQuotes, setMarketQuotes] = useState<MarketQuote[]>([]);
  const [portfolioReady, setPortfolioReady] = useState(false);
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [assetDraft, setAssetDraft] = useState<AssetDraft>(EMPTY_DRAFT);
  const [assetError, setAssetError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [marketStatus, setMarketStatus] = useState<"ready" | "live" | "fallback">(
    "ready",
  );
  const [updatedAt, setUpdatedAt] = useState("2026/08/07 14:30");
  const previousAverageYield = useRef(getAverageYield(DEFAULT_ASSETS));

  const refreshMarket = useCallback(async (quiet = false) => {
    if (!quiet) setIsRefreshing(true);

    try {
      const response = await fetch(`./market-data.json?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Market data unavailable");

      const payload = (await response.json()) as {
        updatedAt?: string;
        quotes?: MarketQuote[];
      };
      if (!payload.quotes?.length) throw new Error("No quotes");

      setMarketQuotes(payload.quotes);

      setAssets((current) =>
        current.map((asset) => {
          const quote = payload.quotes?.find((item) => item.code === asset.code);
          if (!quote || !Number.isFinite(quote.price)) return asset;
          return {
            ...asset,
            price: quote.price,
            previousPrice: quote.previousPrice ?? asset.previousPrice,
            dividends: quote.dividends?.length
              ? quote.dividends
              : asset.dividends,
            candles: quote.candles?.length ? quote.candles : asset.candles,
            yieldMode:
              asset.yieldMode ??
              (quote.dividends?.length ? "history" : undefined),
          };
        }),
      );
      setUpdatedAt(
        payload.updatedAt
          ? new Date(payload.updatedAt).toLocaleString("zh-TW", {
              hour12: false,
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "剛剛",
      );
      setMarketStatus("live");
    } catch {
      setMarketStatus("fallback");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(PORTFOLIO_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Asset[];
          if (
            Array.isArray(parsed) &&
            parsed.length > 0 &&
            parsed.every(
              (asset) =>
                typeof asset.code === "string" &&
                typeof asset.name === "string" &&
                Number.isFinite(asset.price) &&
                Number.isFinite(asset.yieldRate),
            )
          ) {
            const enriched = parsed.map(enrichStoredAsset);
            setAssets(enriched);
            setMonthlyTarget((200000 * getAverageYield(enriched)) / 100 / 12);
          }
        }
      } catch {
        window.localStorage.removeItem(PORTFOLIO_STORAGE_KEY);
      }

      setPortfolioReady(true);
      void refreshMarket(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshMarket]);

  useEffect(() => {
    if (!portfolioReady) return;
    window.localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(assets));
  }, [assets, portfolioReady]);

  const portfolioAverageYield = useMemo(() => getAverageYield(assets), [assets]);

  useEffect(() => {
    if (!portfolioReady) return;
    if (Math.abs(previousAverageYield.current - portfolioAverageYield) < 0.0001) {
      return;
    }
    previousAverageYield.current = portfolioAverageYield;

    const timer = window.setTimeout(() => {
      if (linkDirection === "capital") {
        setMonthlyTarget((budget * portfolioAverageYield) / 100 / 12);
      } else {
        setBudget(
          portfolioAverageYield > 0
            ? (monthlyTarget * 12) / (portfolioAverageYield / 100)
            : 0,
        );
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [budget, linkDirection, monthlyTarget, portfolioAverageYield, portfolioReady]);

  const calculations = useMemo(() => {
    const equalShare = budget / assets.length;
    return assets.map((asset) => {
      const shares = Math.floor(equalShare / (asset.price * unit)) * unit;
      const invested = shares * asset.price;
      const annualDividendPerShare = getAnnualDividendPerShare(asset);
      const annualDividend = shares * annualDividendPerShare;
      return {
        ...asset,
        shares,
        invested,
        annualDividend,
        annualDividendPerShare,
        estimatedYield: getEstimatedYield(asset),
      };
    });
  }, [assets, budget, unit]);

  const monthlyForecast = useMemo(
    () =>
      MONTH_LABELS.map((label, monthIndex) => {
        const contributors = calculations
          .map((asset) => {
            const records = getRecentDividends(asset);
            const isManualEstimate =
              asset.yieldMode === "manual" || records.length === 0;
            const paymentMonths = getForecastPaymentMonths(asset);
            if (!isManualEstimate && !paymentMonths.includes(monthIndex)) {
              return null;
            }
            return {
              code: asset.code,
              amount: isManualEstimate
                ? asset.annualDividend / 12
                : asset.shares * getAverageDividendPerPayment(asset),
              accent: asset.accent,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);

        return {
          label,
          amount: contributors.reduce((sum, item) => sum + item.amount, 0),
          contributors,
        };
      }),
    [calculations],
  );

  const totals = useMemo(() => {
    const invested = calculations.reduce((sum, item) => sum + item.invested, 0);
    const annualDividend = calculations.reduce(
      (sum, item) => sum + item.annualDividend,
      0,
    );
    const averageYield = portfolioAverageYield;
    const requiredCapital =
      averageYield > 0 ? (monthlyTarget * 12) / (averageYield / 100) : 0;

    return {
      invested,
      remaining: Math.max(budget - invested, 0),
      annualDividend,
      monthlyDividend: annualDividend / 12,
      averageYield,
      requiredCapital,
      gap: Math.max(requiredCapital - budget, 0),
    };
  }, [budget, calculations, monthlyTarget, portfolioAverageYield]);

  const syncForAssets = (nextAssets: Asset[]) => {
    const nextYield = getAverageYield(nextAssets);
    setAssets(nextAssets);
    if (linkDirection === "capital") {
      setMonthlyTarget((budget * nextYield) / 100 / 12);
    } else {
      setBudget(nextYield > 0 ? (monthlyTarget * 12) / (nextYield / 100) : 0);
    }
  };

  const updateBudget = (value: string) => {
    const nextBudget = parseNumericInput(value);
    setLinkDirection("capital");
    setBudget(nextBudget);
    setMonthlyTarget((nextBudget * portfolioAverageYield) / 100 / 12);
  };

  const updateMonthlyIncome = (value: string) => {
    const nextIncome = parseNumericInput(value);
    setLinkDirection("income");
    setMonthlyTarget(nextIncome);
    setBudget(
      portfolioAverageYield > 0
        ? (nextIncome * 12) / (portfolioAverageYield / 100)
        : 0,
    );
  };

  const updateAsset = (code: string, field: "price" | "yieldRate", value: string) => {
    const nextValue = parseNumericInput(value);
    const nextAssets = assets.map((asset) => {
      if (asset.code !== code) return asset;
      return field === "yieldRate"
        ? { ...asset, yieldRate: nextValue, yieldMode: "manual" as const }
        : { ...asset, price: nextValue };
    });
    syncForAssets(nextAssets);
  };

  const addAsset = (asset: Asset) => {
    if (assets.some((item) => item.code === asset.code)) {
      setAssetError(`${asset.code} 已經在投資組合中`);
      return;
    }

    const quote = marketQuotes.find((item) => item.code === asset.code);
    syncForAssets([
      ...assets,
      {
        ...asset,
        price: quote?.price ?? asset.price,
        previousPrice: quote?.previousPrice ?? asset.previousPrice,
        dividends: quote?.dividends?.length
          ? quote.dividends
          : asset.dividends,
        candles: quote?.candles?.length ? quote.candles : asset.candles,
        yieldMode:
          asset.yieldMode ??
          (quote?.dividends?.length ? "history" : undefined),
      },
    ]);
    setAssetError("");
  };

  const removeAsset = (code: string) => {
    if (assets.length <= 1) return;
    syncForAssets(assets.filter((asset) => asset.code !== code));
  };

  const updateDraftCode = (value: string) => {
    const code = value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 10);
    const preset = ASSET_CATALOG.find((asset) => asset.code === code);
    setAssetDraft((current) =>
      preset
        ? {
            code,
            market: preset.market,
            name: preset.name,
            price: String(preset.price),
            yieldRate: String(preset.yieldRate),
          }
        : { ...current, code },
    );
    setAssetError("");
  };

  const submitCustomAsset = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = assetDraft.code.trim().toUpperCase();
    const name = assetDraft.name.trim();
    const price = parseNumericInput(assetDraft.price);
    const yieldRate = parseNumericInput(assetDraft.yieldRate);

    if (!code || !name || price <= 0) {
      setAssetError("請填寫代號、名稱與大於 0 的參考價");
      return;
    }

    addAsset({
      code,
      market: assetDraft.market,
      name,
      price,
      previousPrice: price,
      yieldRate,
      yieldMode: "manual",
      dividends: [],
      candles: [],
      accent: ACCENT_COLORS[assets.length % ACCENT_COLORS.length],
    });
    if (!assets.some((asset) => asset.code === code)) {
      setAssetDraft(EMPTY_DRAFT);
    }
  };

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="配配看首頁">
          <span className="brand-mark" aria-hidden="true">
            配
          </span>
          <span>配配看</span>
        </a>
        <div className="market-pill" title={`行情更新：${updatedAt}`}>
          <span
            className={`status-dot ${marketStatus === "fallback" ? "is-muted" : ""}`}
          />
          {marketStatus === "fallback" ? "使用預設行情" : `行情 ${updatedAt}`}
        </div>
      </header>

      <section className="target-section" id="top" aria-labelledby="target-title">
        <div className="target-copy">
          <p className="step-label">01 ／ 雙向換算</p>
          <h2 id="target-title">投入本金 ⇄ 每月月領</h2>
          <p>
            兩邊都可以輸入。改總投入會算出平均每月現金流；改每月月領則會反推總投入，並依目前 {assets.length} 檔最近四次配息推估。
          </p>

          <label className="target-input">
            <span>總投入金額</span>
            <div>
              <b>NT$</b>
              <input
                aria-label="雙向換算總投入金額"
                inputMode="numeric"
                value={number.format(budget)}
                onChange={(event) => updateBudget(event.target.value)}
              />
              <em>本金</em>
            </div>
            <small className={linkDirection === "capital" ? "active-link-side" : ""}>
              {linkDirection === "capital" ? "你最後輸入這一側" : "由月領金額反推"}
            </small>
          </label>
        </div>

        <div className="target-result">
          <div className="link-direction-mark" aria-hidden="true">⇄</div>
          <label className="monthly-income-input">
            <span>每月月領金額</span>
            <div>
              <b>NT$</b>
              <input
                aria-label="雙向換算每月月領金額"
                inputMode="numeric"
                value={number.format(monthlyTarget)}
                onChange={(event) => updateMonthlyIncome(event.target.value)}
              />
              <em>／ 月</em>
            </div>
            <small className={linkDirection === "income" ? "active-link-side" : ""}>
              {linkDirection === "income" ? "你最後輸入這一側" : "由總投入金額換算"}
            </small>
          </label>
          <div className="target-meta">
            <div>
              <span>預估年現金流</span>
              <b>{money.format(monthlyTarget * 12)}</b>
            </div>
            <div>
              <span>組合平均殖利率</span>
              <b>{portfolioAverageYield.toFixed(2)}%</b>
            </div>
          </div>
          <p className="link-calculation-note">
            算式：所選標的近四次配息換算殖利率的平均。實際配息仍以各基金公告為準。
          </p>
        </div>
      </section>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">TAIWAN ETF ALLOCATOR</p>
          <h1>
            把每一筆預算，
            <span>配成看得懂的現金流。</span>
          </h1>
          <p className="hero-description">
            輸入預算，自由增減投資標的並平均配置；也能從每月想領的金額，反推需要準備的本金。
          </p>
        </div>

        <div className="income-card" aria-label="預估每月現金流">
          <div className="income-card-top">
            <span>平均每月現金流</span>
            <span className="trend-chip">平均殖利率 {totals.averageYield.toFixed(1)}%</span>
          </div>
          <strong>{money.format(totals.monthlyDividend)}</strong>
          <p>全部標的近四次配息預估總額加總，再除以 12 個月。</p>
          <div className="mini-bars" aria-hidden="true">
            {calculations.map((asset) => (
              <span
                key={asset.code}
                style={{
                  height: `${Math.max(22, (asset.annualDividend / Math.max(...calculations.map((item) => item.annualDividend), 1)) * 100)}%`,
                  background: asset.accent,
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="planner-card" aria-labelledby="allocation-title">
        <div className="section-heading">
          <div>
            <p className="step-label">02 ／ 預算配置</p>
            <h2 id="allocation-title">這筆錢，可以怎麼買？</h2>
          </div>
          <button
            className="refresh-button"
            type="button"
            onClick={() => refreshMarket()}
            disabled={isRefreshing}
          >
            <span className={isRefreshing ? "is-spinning" : ""}>↻</span>
            {isRefreshing ? "更新中" : "更新行情"}
          </button>
        </div>

        <div className="control-grid">
          <label className="field-card budget-field">
            <span>可投入預算</span>
            <div className="currency-input">
              <b>NT$</b>
              <input
                aria-label="可投入預算"
                inputMode="numeric"
                value={number.format(budget)}
                onChange={(event) => updateBudget(event.target.value)}
              />
            </div>
          </label>
          <div className="field-card">
            <span>買進單位</span>
            <div className="segmented" role="group" aria-label="買進單位">
              <button
                type="button"
                className={unit === 1 ? "active" : ""}
                onClick={() => setUnit(1)}
              >
                零股
                <small>1 股</small>
              </button>
              <button
                type="button"
                className={unit === 1000 ? "active" : ""}
                onClick={() => setUnit(1000)}
              >
                整張
                <small>1,000 股</small>
              </button>
            </div>
          </div>
          <div className="field-card summary-field">
            <span>本次實際投入</span>
            <strong>{money.format(totals.invested)}</strong>
            <small>預留現金 {money.format(totals.remaining)}</small>
          </div>
        </div>

        <div className="allocation-list">
          <div className="allocation-header" aria-hidden="true">
            <span>投資標的</span>
            <span>即時參考價</span>
            <span>建議股數</span>
            <span>投入金額</span>
            <span>平均月息</span>
          </div>
          {calculations.map((asset) => {
            const priceChange = asset.price - asset.previousPrice;
            return (
              <article className="allocation-row" key={asset.code}>
                <div className="asset-name">
                  <span className="asset-swatch" style={{ background: asset.accent }} />
                  <div>
                    <strong>{asset.code}</strong>
                    <small>{asset.name}</small>
                  </div>
                  <button
                    className="remove-asset-button"
                    type="button"
                    onClick={() => removeAsset(asset.code)}
                    disabled={assets.length === 1}
                    aria-label={`移除 ${asset.code}`}
                    title={assets.length === 1 ? "至少保留一檔標的" : `移除 ${asset.code}`}
                  >
                    移除
                  </button>
                </div>
                <label className="editable-value price-value">
                  <span className="mobile-label">參考價</span>
                  <div>
                    <span>NT$</span>
                    <input
                      aria-label={`${asset.code} 參考價`}
                      inputMode="decimal"
                      value={asset.price}
                      onChange={(event) =>
                        updateAsset(asset.code, "price", event.target.value)
                      }
                    />
                  </div>
                  <small className={priceChange >= 0 ? "up" : "down"}>
                    {priceChange >= 0 ? "+" : ""}
                    {priceChange.toFixed(2)}
                  </small>
                  <CandlestickChart asset={asset} />
                </label>
                <div className="row-metric">
                  <span className="mobile-label">建議股數</span>
                  <strong>{number.format(asset.shares)} 股</strong>
                </div>
                <div className="row-metric">
                  <span className="mobile-label">投入金額</span>
                  <strong>{money.format(asset.invested)}</strong>
                </div>
                <div className="row-metric dividend-metric">
                  <span className="mobile-label">平均月息</span>
                  <strong>{money.format(asset.annualDividend / 12)}</strong>
                  <small>
                    {asset.yieldMode === "manual" ? "自訂" : "近四次"}殖利率 {asset.estimatedYield.toFixed(1)}%
                  </small>
                </div>
              </article>
            );
          })}
        </div>

        <div className="portfolio-actions">
          <div>
            <strong>目前 {assets.length} 檔</strong>
            <span>預算會平均分成 {assets.length} 份</span>
          </div>
          <button
            className="add-asset-button"
            type="button"
            onClick={() => {
              setIsAddingAsset((current) => !current);
              setAssetError("");
            }}
            aria-expanded={isAddingAsset}
          >
            <span aria-hidden="true">＋</span>
            {isAddingAsset ? "收起新增區" : "新增投資標的"}
          </button>
        </div>

        {isAddingAsset && (
          <div className="asset-builder">
            <div className="asset-builder-heading">
              <div>
                <span>快速加入</span>
                <h3>選一檔常用 ETF</h3>
              </div>
              <button
                type="button"
                onClick={() => syncForAssets(DEFAULT_ASSETS)}
                className="reset-assets-button"
              >
                恢復預設四檔
              </button>
            </div>

            <div className="suggested-assets">
              {SUGGESTED_ASSETS.map((asset) => {
                const isSelected = assets.some((item) => item.code === asset.code);
                return (
                  <button
                    type="button"
                    key={asset.code}
                    disabled={isSelected}
                    onClick={() => addAsset(asset)}
                  >
                    <i style={{ background: asset.accent }} />
                    <span>
                      <strong>{asset.code}</strong>
                      <small>{asset.name}</small>
                    </span>
                    <b>{isSelected ? "已加入" : "＋"}</b>
                  </button>
                );
              })}
            </div>

            <div className="custom-asset-title">
              <span>或輸入其他股票／ETF</span>
              <small>自訂標的請自行填寫參考價；常用 ETF 會隨網站行情更新。</small>
            </div>
            <form className="custom-asset-form" onSubmit={submitCustomAsset}>
              <label>
                <span>代號</span>
                <input
                  value={assetDraft.code}
                  onChange={(event) => updateDraftCode(event.target.value)}
                  placeholder="例如 2330"
                  aria-label="新增標的代號"
                />
              </label>
              <label className="asset-name-input">
                <span>名稱</span>
                <input
                  value={assetDraft.name}
                  onChange={(event) =>
                    setAssetDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="例如 台積電"
                  aria-label="新增標的名稱"
                />
              </label>
              <label>
                <span>市場</span>
                <select
                  value={assetDraft.market}
                  onChange={(event) =>
                    setAssetDraft((current) => ({
                      ...current,
                      market: event.target.value as "tse" | "otc",
                    }))
                  }
                  aria-label="新增標的市場"
                >
                  <option value="tse">上市</option>
                  <option value="otc">上櫃</option>
                </select>
              </label>
              <label>
                <span>參考價</span>
                <input
                  inputMode="decimal"
                  value={assetDraft.price}
                  onChange={(event) =>
                    setAssetDraft((current) => ({
                      ...current,
                      price: event.target.value,
                    }))
                  }
                  placeholder="0.00"
                  aria-label="新增標的參考價"
                />
              </label>
              <label>
                <span>預估殖利率</span>
                <div className="percent-input">
                  <input
                    inputMode="decimal"
                    value={assetDraft.yieldRate}
                    onChange={(event) =>
                      setAssetDraft((current) => ({
                        ...current,
                        yieldRate: event.target.value,
                      }))
                    }
                    placeholder="0.0"
                    aria-label="新增標的預估殖利率"
                  />
                  <b>%</b>
                </div>
              </label>
              <button className="submit-asset-button" type="submit">
                加入組合
              </button>
            </form>
            {assetError && <p className="asset-error" role="alert">{assetError}</p>}
          </div>
        )}
      </section>

      <section className="dividend-section" aria-labelledby="dividend-history-title">
        <div className="section-heading dividend-heading">
          <div>
            <p className="step-label">03 ／ 配息現金流</p>
            <h2 id="dividend-history-title">最近四次配息，拆成每個月看</h2>
          </div>
          <p>
            平均月現金流＝全部所選標的近四次預估配息加總 ÷ 12；月曆則依歷史發放月份列出可能入帳金額。
          </p>
        </div>

        <div className="dividend-history-grid">
          {calculations.map((asset) => {
            const records = getRecentDividends(asset);
            const recentDividendTotal = records.reduce(
              (sum, dividend) => sum + dividend.amount,
              0,
            );
            return (
              <article className="dividend-history-card" key={asset.code}>
                <div className="dividend-card-title">
                  <span className="asset-swatch" style={{ background: asset.accent }} />
                  <div>
                    <strong>{asset.code}</strong>
                    <small>{asset.name}</small>
                  </div>
                  <b>
                    {asset.yieldMode === "manual" || records.length === 0
                      ? "自訂估算"
                      : "近四次"}
                  </b>
                </div>

                {records.length > 0 ? (
                  <div className="dividend-records">
                    {records.map((dividend) => (
                      <div key={`${asset.code}-${dividend.paymentDate}`}>
                        <span>{dividend.paymentDate}</span>
                        <strong>每股 {decimal.format(dividend.amount)} 元</strong>
                        <small>
                          依 {number.format(asset.shares)} 股約 {money.format(asset.shares * dividend.amount)}
                        </small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-dividend-history">
                    尚無官方配息紀錄，暫以你設定的 {asset.yieldRate.toFixed(2)}% 殖利率平均估算。
                  </p>
                )}

                <div className="dividend-card-total">
                  <span>近四次合計／每股</span>
                  <b>
                    {decimal.format(
                      records.length > 0
                        ? recentDividendTotal
                        : asset.annualDividendPerShare,
                    )} 元
                  </b>
                  <span>
                    {records.length > 0
                      ? `依發放間隔推估每年 ${getDividendFrequency(asset)} 次，`
                      : "依自訂殖利率，"}
                    平均每月約 {money.format(asset.annualDividend / 12)}
                  </span>
                </div>
              </article>
            );
          })}
        </div>

        <div className="cashflow-calendar">
          <div className="cashflow-calendar-heading">
            <div>
              <span>12 個月預估入帳分布</span>
              <strong>各月金額是當月可能配息標的的加總</strong>
            </div>
            <div>
              <span>全年預估</span>
              <strong>{money.format(totals.annualDividend)}</strong>
              <small>平均每月 {money.format(totals.monthlyDividend)}</small>
            </div>
          </div>
          <div className="cashflow-month-grid">
            {monthlyForecast.map((month) => (
              <article className={month.amount > 0 ? "has-cashflow" : ""} key={month.label}>
                <span>{month.label}</span>
                <strong>{money.format(month.amount)}</strong>
                <div aria-label={`${month.label}配息標的`}>
                  {month.contributors.length > 0
                    ? month.contributors.map((item) => (
                        <small key={item.code} style={{ borderColor: item.accent }}>
                          {item.code}
                        </small>
                      ))
                    : <small>—</small>}
                </div>
              </article>
            ))}
          </div>
          <p className="cashflow-formula-note">
            例如只保留 0056、00713、00878 三檔時，上方「平均每月現金流」就是三檔全年預估配息合計後除以 12，不是再把三檔月息除以 3。
          </p>
        </div>
      </section>

      <section className="assumptions-card" aria-labelledby="assumptions-title">
        <div>
          <p className="step-label">04 ／ 估算條件</p>
          <h2 id="assumptions-title">也可以改用自訂殖利率</h2>
          <p>有近四次配息的標的會優先依歷史金額計算；修改欄位後，該檔會改用你的自訂殖利率。</p>
        </div>
        <div className="yield-grid">
          {assets.map((asset) => (
            <label className="yield-field" key={asset.code}>
              <span>
                <i style={{ background: asset.accent }} />
                {asset.code}
              </span>
              <div>
                <input
                  aria-label={`${asset.code} 預估年殖利率`}
                  inputMode="decimal"
                  value={
                    asset.yieldMode === "manual"
                      ? asset.yieldRate
                      : getEstimatedYield(asset).toFixed(2)
                  }
                  onChange={(event) =>
                    updateAsset(asset.code, "yieldRate", event.target.value)
                  }
                />
                <b>%</b>
              </div>
            </label>
          ))}
        </div>
      </section>

      <footer>
        <div>
          <span className="brand-mark small" aria-hidden="true">
            配
          </span>
          <p>
            行情來源：臺灣證券交易所／證券櫃檯買賣中心公開資訊。價格可能延遲，實際成交價與配息以官方公告為準。
          </p>
        </div>
        <p>本工具僅供試算，不構成投資建議。</p>
      </footer>
    </main>
  );
}
