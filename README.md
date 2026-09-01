# GMMS MES Demo

面向 CNC 加工厂的最小可用 MES 演示版。

## 已实现闭环

扫码绑定工序任务 → 人/机/任务建立绑定 → 开始加工 → 模拟 CNC 周期信号 → ANDON 异常 → 确认/解决 → 恢复 → 完工并释放装配工序。

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:3000`。

## 验证

```bash
npm test
npx tsc --noEmit
```

## 技术边界

首版使用内存态的模拟设备网关，核心状态机位于 `lib/mes.ts`。真实 OPC UA / MTConnect 接入应只转为标准化设备事件，不直接改写订单或任务状态。
