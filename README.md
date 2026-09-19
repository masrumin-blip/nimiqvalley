# NimiqValley

Enter Nimiq Village, play fifteen arcade games, or meet the NimiqValley AI chat characters.

**Live app**: https://nimiqvalley.lovable.app

## Features

- **Nimiq Village** — explore a Nimiq-themed virtual village
- **15 arcade games** — a collection of mini games to play in the browser
- **AI chat characters** — meet and chat with the NimiqValley characters
- **Daily rewards** — come back every day to claim rewards

## Built with

- [TanStack Start](https://tanstack.com/start) — full-stack React framework
- [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com)

## Development

You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone https://github.com/masrumin-blip/nimiqvalley.git
cd nimiqvalley
npm install
npm run dev
```

Then open http://localhost:8080 in your browser.

## Configuration & secrets

Copy `.env.example` to `.env` and point it at your own backend project.

The values in `.env` are public by design: the backend URL, the project id and
the publishable (anon) key are all sent to the browser anyway, and access is
enforced by database row-level security rules, not by hiding these values.

Private values are **never** stored in this repository. `SESSION_SECRET`, the
service role key and any AI provider keys live in the hosting provider's secret
store and are injected into the server at runtime. Never commit them.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
