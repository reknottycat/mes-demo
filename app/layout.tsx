import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GMMS · 工厂 MES",
  description: "订单、工序、设备与 ANDON 的生产执行工作台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
