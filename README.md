# 🌾 NimiqValley

An interactive Web3 portfolio village and arcade hub powered by **Nimiq** 

## ✨ Highlights

- **Interactive Village:** Explore the 2.5D village, talk with AI villagers, and visit the on-chain Post Office.
- **15 Retro Games:** Arcade mini-games featuring server-side anti-cheat and verified leaderboards.
- **Crypto Leagues:** Community tournaments with automated prize pools paid in **NIM** and **USDT**.
- **Shop & Economy:** Key shop and AI passes with real-time NIM/USDT pricing.

## 🛠 Tech Stack

- **Frontend & Fullstack:** TanStack Start v1 (React 19), Tailwind CSS v4
- **Database:** PostgreSQL (Lovable Cloud / Supabase) with Row-Level Security
- **Web3:** Nimiq RPC 2.0 (Albatross) & Polygon (USDT ERC-20 via Viem)

## 🔐 Required Secrets

Set these in your server environment / secrets settings:

- `ADMIN_WALLETS` – Admin Nimiq wallet addresses (`NQ...`).
- `LEAGUE_TREASURY_NIM` – Treasury address for NIM deposits.
- `LEAGUE_TREASURY_POLYGON` – Treasury address for USDT on Polygon (`0x...`).
- `LEAGUE_TREASURY_POLYGON_KEY` – Private key for USDT automated payouts.
- `SESSION_SECRET` – Random 32+ char string for session encryption.

## 🚀 Quick Start

```bash
git clone https://github.com/masrumin-blip/nimiqvalley.git
cd nimiqvalley
bun install    # or npm install
bun dev        # or npm run dev
