import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "配配看｜ETF 財產分配器",
  description: "輸入預算，平均配置台灣高股息 ETF 與美債 ETF，並反推月配息目標所需本金。",
  openGraph: {
    title: "配配看｜ETF 財產分配器",
    description: "把每一筆預算，配成看得懂的現金流。",
    images: ["/og.png"],
    locale: "zh_TW",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "配配看｜ETF 財產分配器",
    description: "把每一筆預算，配成看得懂的現金流。",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
