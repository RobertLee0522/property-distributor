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

const SUGGESTED_ASSETS: Asset[] = [
  {
    code: "0050",
    market: "tse",
    name: "元大台灣50",
    price: 102.85,
    previousPrice: 103.3,
    yieldRate: 2.5,
    accent: "#4377bd",
  },
  {
    code: "006208",
    market: "tse",
    name: "富邦台50",
    price: 235.35,
    previousPrice: 236.55,
    yieldRate: 2.6,
    accent: "#7b62b3",
  },
  {
    code: "00919",
    market: "tse",
    name: "群益台灣精選高息",
    price: 29.74,
    previousPrice: 29.6,
    yieldRate: 10,
    accent: "#3997a3",
  },
  {
    code: "00929",
    market: "tse",
    name: "復華台灣科技優息",
    price: 28.59,
    previousPrice: 28.94,
    yieldRate: 6,
    accent: "#ba6a9c",
  },
  {
    code: "00940",
    market: "tse",
    name: "元大台灣價值高息",
    price: 12.4,
    previousPrice: 12.45,
    yieldRate: 8,
    accent: "#a37b3b",
  },
  {
    code: "00679B",
    market: "otc",
    name: "元大美債20年",
    price: 26.41,
    previousPrice: 26.66,
    yieldRate: 4.5,
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

function parseNumericInput(value: string) {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

function getAverageYield(assets: Asset[]) {
  if (assets.length === 0) return 0;
  return assets.reduce((sum, asset) => sum + asset.yieldRate, 0) / assets.length;
}

export default function Home() {
  const [budget, setBudget] = useState(200000);
  const [monthlyTarget, setMonthlyTarget] = useState(1238);
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
            setAssets(parsed);
            setMonthlyTarget((200000 * getAverageYield(parsed)) / 100 / 12);
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
    const nextAssets = assets.map((asset) =>
      asset.code === code ? { ...asset, [field]: nextValue } : asset,
    );
    if (field === "yieldRate") syncForAssets(nextAssets);
    else setAssets(nextAssets);
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

      <section className="hero" id="top">
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

      <section className="target-section" aria-labelledby="target-title">
        <div className="target-copy">
          <p className="step-label">02 ／ 雙向換算</p>
          <h2 id="target-title">投入本金 ⇄ 每月月領</h2>
          <p>
            兩邊都可以輸入。改總投入會算出每月月領；改每月月領則會反推總投入，並依目前 {assets.length} 檔的平均殖利率同步更新。
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
            以預估年殖利率換算；實際配息金額與發放月份仍以各基金公告為準。
          </p>
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
