"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Asset = {
  code: string;
  market: "tse" | "otc";
  name: string;
  price: number;
  previousPrice: number;
  yieldRate: number;
  accent: string;
};

type MarketQuote = {
  code: string;
  price: number;
  previousPrice?: number;
  name?: string;
  updatedAt?: string;
};

const DEFAULT_ASSETS: Asset[] = [
  {
    code: "0056",
    market: "tse",
    name: "元大高股息",
    price: 51.05,
    previousPrice: 51.3,
    yieldRate: 9.2,
    accent: "#5662d9",
  },
  {
    code: "00713",
    market: "tse",
    name: "元大台灣高息低波",
    price: 61.3,
    previousPrice: 61.1,
    yieldRate: 7.8,
    accent: "#2d8c73",
  },
  {
    code: "00878",
    market: "tse",
    name: "國泰永續高股息",
    price: 32.81,
    previousPrice: 32.84,
    yieldRate: 8.1,
    accent: "#d4853d",
  },
  {
    code: "00687B",
    market: "otc",
    name: "國泰20年美債",
    price: 27.49,
    previousPrice: 27.76,
    yieldRate: 4.6,
    accent: "#c85b68",
  },
];

const money = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 });

function parseNumericInput(value: string) {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

export default function Home() {
  const [budget, setBudget] = useState(200000);
  const [monthlyTarget, setMonthlyTarget] = useState(7000);
  const [unit, setUnit] = useState<1 | 1000>(1);
  const [assets, setAssets] = useState(DEFAULT_ASSETS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [marketStatus, setMarketStatus] = useState<"ready" | "live" | "fallback">(
    "ready",
  );
  const [updatedAt, setUpdatedAt] = useState("2026/08/07 14:30");

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

      setAssets((current) =>
        current.map((asset) => {
          const quote = payload.quotes?.find((item) => item.code === asset.code);
          if (!quote || !Number.isFinite(quote.price)) return asset;
          return {
            ...asset,
            price: quote.price,
            previousPrice: quote.previousPrice ?? asset.previousPrice,
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
      void refreshMarket(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshMarket]);

  const calculations = useMemo(() => {
    const equalShare = budget / assets.length;
    return assets.map((asset) => {
      const shares = Math.floor(equalShare / (asset.price * unit)) * unit;
      const invested = shares * asset.price;
      const annualDividend = invested * (asset.yieldRate / 100);
      return { ...asset, shares, invested, annualDividend };
    });
  }, [assets, budget, unit]);

  const totals = useMemo(() => {
    const invested = calculations.reduce((sum, item) => sum + item.invested, 0);
    const annualDividend = calculations.reduce(
      (sum, item) => sum + item.annualDividend,
      0,
    );
    const averageYield =
      assets.reduce((sum, item) => sum + item.yieldRate, 0) / assets.length;
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
  }, [assets, budget, calculations, monthlyTarget]);

  const updateAsset = (code: string, field: "price" | "yieldRate", value: string) => {
    const nextValue = parseNumericInput(value);
    setAssets((current) =>
      current.map((asset) =>
        asset.code === code ? { ...asset, [field]: nextValue } : asset,
      ),
    );
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

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">TAIWAN ETF ALLOCATOR</p>
          <h1>
            把每一筆預算，
            <span>配成看得懂的現金流。</span>
          </h1>
          <p className="hero-description">
            輸入預算，自動平均配置四檔 ETF；也能從每月想領的金額，反推需要準備的本金。
          </p>
        </div>

        <div className="income-card" aria-label="預估每月現金流">
          <div className="income-card-top">
            <span>預估每月現金流</span>
            <span className="trend-chip">平均殖利率 {totals.averageYield.toFixed(1)}%</span>
          </div>
          <strong>{money.format(totals.monthlyDividend)}</strong>
          <p>依目前配置與自訂殖利率，將年配息平均換算為每月。</p>
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
            <p className="step-label">01 ／ 預算配置</p>
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
                onChange={(event) => setBudget(parseNumericInput(event.target.value))}
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
            <span>預估月息</span>
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
                  <span className="mobile-label">預估月息</span>
                  <strong>{money.format(asset.annualDividend / 12)}</strong>
                  <small>殖利率 {asset.yieldRate.toFixed(1)}%</small>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="target-section" aria-labelledby="target-title">
        <div className="target-copy">
          <p className="step-label">02 ／ 月月領目標</p>
          <h2 id="target-title">想每月領多少？</h2>
          <p>
            以四檔平均配置和目前設定的殖利率估算。配息實際發放月份不同，這裡將全年金額平滑換算成每月。
          </p>

          <label className="target-input">
            <span>每月希望領到</span>
            <div>
              <b>NT$</b>
              <input
                aria-label="每月希望領到的配息"
                inputMode="numeric"
                value={number.format(monthlyTarget)}
                onChange={(event) =>
                  setMonthlyTarget(parseNumericInput(event.target.value))
                }
              />
              <em>／ 月</em>
            </div>
          </label>
        </div>

        <div className="target-result">
          <span>估計需要準備本金</span>
          <strong>{money.format(totals.requiredCapital)}</strong>
          <div className="target-meta">
            <div>
              <span>年配息目標</span>
              <b>{money.format(monthlyTarget * 12)}</b>
            </div>
            <div>
              <span>與目前預算差額</span>
              <b>{totals.gap > 0 ? money.format(totals.gap) : "已達標"}</b>
            </div>
          </div>
          <div className="progress-track" aria-label="目前預算達成率">
            <span
              style={{
                width: `${Math.min((budget / Math.max(totals.requiredCapital, 1)) * 100, 100)}%`,
              }}
            />
          </div>
          <small>
            目前預算約達成 {Math.min((budget / Math.max(totals.requiredCapital, 1)) * 100, 100).toFixed(1)}%
          </small>
        </div>
      </section>

      <section className="assumptions-card" aria-labelledby="assumptions-title">
        <div>
          <p className="step-label">03 ／ 估算條件</p>
          <h2 id="assumptions-title">殖利率可以自己調</h2>
          <p>預設值僅供試算。你可以依最新公告配息與自己的保守程度修改。</p>
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
                  value={asset.yieldRate}
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
