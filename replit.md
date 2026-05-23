# TradeX Trading Platform

A professional trading platform powered by the Deriv WebSocket API — featuring a bot builder, manual trading, charts, analysis tools, copy trading, and an AI scanner.

## Run & Operate

- `pnpm --filter @workspace/tradex run dev` — run the frontend (port 24753)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, shadcn/ui, framer-motion
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Real-time data: Deriv WebSocket API (`wss://ws.binaryws.com/websockets/v3`)
- Charts: lightweight-charts, @deriv/deriv-charts
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/tradex/src/` — React frontend source
- `artifacts/tradex/src/pages/` — Dashboard, BotBuilder, ManualTraders, Charts, TradingBots, AnalysisTool, Strategies, CopyTrading, TradingView, Callback
- `artifacts/tradex/src/components/` — Navbar, BottomBar, AIScanner, LoadingScreen, ThemeProvider, LightweightChart, DerivSmartChart
- `artifacts/tradex/src/context/AuthContext.tsx` — Deriv OAuth + WebSocket auth state
- `artifacts/tradex/src/context/BotContext.tsx` — Bot configuration state
- `artifacts/tradex/src/hooks/useDerivWS.ts` — Deriv WebSocket tick hook
- `artifacts/tradex/public/smartcharts-chunks/` — Deriv SmartChart JS bundles
- `lib/api-spec/openapi.yaml` — API spec (source of truth)
- `lib/db/src/schema/` — Drizzle DB schema

## Architecture decisions

- Pure frontend SPA — trades directly against Deriv WebSocket, no custom backend required for core trading
- Tab-based navigation via custom `tradex:navigate` event (avoids router complexity for SPA)
- OAuth redirect uses `window.location.host` dynamically so it works across dev/prod domains
- Deriv App ID `129077` hardcoded; OAuth redirect URI must be registered in Deriv developer console

## Product

TradeX PRO is a web-based trading terminal for Deriv markets. Users connect their Deriv account via OAuth, then access: live dashboards with tick data, an automated bot builder, manual trade execution, lightweight & smart charts, AI signal scanning, strategy management, copy trading, and the full TradingView integration.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The OAuth redirect URI must match exactly what's registered in the Deriv API dashboard for app_id 129077
- `smartcharts-chunks/` are large binary assets — do not delete them, they are required for DerivSmartChart
- Deriv WebSocket connects to `wss://ws.binaryws.com/websockets/v3?app_id=129077`
- The Callback page handles the OAuth flow; it detects the `acct1` query param Deriv appends after redirect

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
