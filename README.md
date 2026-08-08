# 配配看｜ETF 財產分配器

一個可直接發布到 GitHub Pages 的台灣 ETF 預算與月配息試算網站。

## 功能

- 輸入預算，平均配置 0056、00713、00878、00687B
- 支援零股與整張試算
- 顯示每檔建議股數、投入金額、剩餘現金與預估月息
- 輸入每月配息目標，反推所需本金
- 可自行修改價格與預估年殖利率
- GitHub Actions 於台股交易時段每 15 分鐘更新官方行情並重新發布

## 發布到 GitHub Pages

1. 將整個專案推到 GitHub，預設分支命名為 `main`。
2. 到儲存庫的 **Settings → Pages**。
3. 在 **Build and deployment** 的 Source 選擇 **GitHub Actions**。
4. 到 **Actions** 頁籤執行「更新行情並發布網站」，或等待推送後自動執行。

## 本機開發

```bash
npm install
npm run dev
```

GitHub Pages 版本可用：

```bash
npm run build:github
```

> 本工具僅供試算，不構成投資建議。價格與配息以官方公告為準。
