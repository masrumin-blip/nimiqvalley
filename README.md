# 🌾 NimiqValley

> An interactive Web3 portfolio village, retro arcade portal, and community hub powered by **Nimiq** and **Polygon**.

NimiqValley connects on-chain crypto assets with interactive gameplay. Built as a dual-chain application, it runs seamlessly in standard web browsers and inside the **Nimiq Pay** mobile wallet as a native Mini App.

---

## 🌟 Core Highlights

- **Interactive 2.5D Village:** A living canvas world with day/night cycles, ambient wildlife, and player houses that dynamically evolve based on live wallet balances (*Poor* to *Sultan* tiers).
- **On-Chain Post Office:** Send and receive peer-to-peer crypto letters with verified **NIM** and **USDT** gifts attached.
- **15 Arcade & Multiplayer Games:** A retro game suite featuring single-player games with server-side anti-cheat telemetry and real-time 1v1 PvP modes (Soccer, Checkers, Carrom).
- **Dual-Token Economy:** Earn in-game coins through gameplay and redeem them for real nimiq coins from the treasury. Buy match keys and AI passes with real-time price feeds.
- **Crypto Leagues & Tournaments:** Create or compete in community-funded leagues with automated on-chain payouts in NIM or USDT.
- **Social Arena & AI Villagers:** Global and direct player messaging, plus AI-powered NPC companions with distinct lore and personalities.

---

## 🛠️ Tech Stack & Architecture

- **Full-Stack Framework:** [TanStack Start v1](https://tanstack.com/start) (React 19, Server Functions, SSR)
- **Styling:** Tailwind CSS v4
- **Database & Realtime:** Lovable Cloud (PostgreSQL with Row-Level Security)
- **Web3 Ecosystem:**
  - `@nimiq/mini-app-sdk` & `@nimiq/core` (Albatross 2.0 RPC) — Nimiq L1 operations
  - `viem` — Polygon EVM interactions (USDT ERC-20 transfers)

---

## 🔐 Required Secrets

Set these in your server environment / secrets configuration:

| Variable | Description |
| :--- | :--- |
| `SESSION_SECRET` | 32+ character random secret for player session encryption |
| `ADMIN_WALLETS` | Comma-separated admin Nimiq wallet addresses (`NQ...`) |
| `LEAGUE_TREASURY_NIM` | Public Nimiq address holding league and redemption funds |
| `LEAGUE_TREASURY_POLYGON` | Public Polygon address (`0x...`) holding USDT deposits |
| `LEAGUE_TREASURY_POLYGON_KEY` | Private key for automated Polygon USDT prize distribution |
| `CRON_SECRET` | Bearer token securing background league settlement tasks |

---

## 🚀 Quick Start

### 1. Installation
```bash
git clone https://github.com/masrumin-blip/nimiqvalley.git
cd nimiqvalley
bun install    # or npm install
bun dev        # or npm run dev
bun run build
bun run preview

