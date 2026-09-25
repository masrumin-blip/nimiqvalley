import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { PlayerBadge } from "@/components/PlayerBadge";
import { VerifyInfoButton } from "@/components/VerifyInfoButton";
import { usePlayer } from "@/hooks/usePlayer";
import { createLeague } from "@/lib/leagues.functions";
import { LEAGUE_GAMES, VERIFY_METHODS, type LeagueSlug } from "@/lib/verification-info";

const title = "Create a League — NimiqValley";
const description = "Pick a verified game, set a locked schedule, and fund a NIM or USDT prize pool.";

export const Route = createFileRoute("/leagues/new")({
  ssr: false,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewLeague,
});

function localInput(d: Date) {
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function NewLeague() {
  const { player } = usePlayer();
  const navigate = useNavigate();
  const create = useServerFn(createLeague);
  const [slug, setSlug] = useState<LeagueSlug>("tappy");
  const [name, setName] = useState("");
  const [start, setStart] = useState(() => localInput(new Date(Date.now() + 10 * 60_000)));
  const [end, setEnd] = useState(() => localInput(new Date(Date.now() + 24 * 3_600_000)));
  const [payout, setPayout] = useState<"winner" | "top3">("top3");
  const [token, setToken] = useState<"nim" | "usdt">("nim");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const { id } = await create({
        data: {
          gameSlug: slug,
          title: name,
          startsAt: new Date(start).toISOString(),
          endsAt: new Date(end).toISOString(),
          payout,
          token,
        },
      });
      void navigate({ to: "/leagues/$id", params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the league.");
    } finally {
      setBusy(false);
    }
  };

  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-bold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`;

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-2">
          <Link to="/leagues" className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground hover:bg-accent">
            ← Leagues
          </Link>
          <PlayerBadge />
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground">Create a league</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Once the prize pool is funded, the game, schedule, and prize split are locked and can't be changed by anyone.
        </p>

        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold text-foreground">1. Game</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {LEAGUE_GAMES.map((g) => (
              <div
                key={g.slug}
                role="button"
                tabIndex={0}
                onClick={() => setSlug(g.slug)}
                onKeyDown={(e) => e.key === "Enter" && setSlug(g.slug)}
                className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-left ${slug === g.slug ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                <div>
                  <div className="text-sm font-bold text-foreground">{g.name}</div>
                  <div className="text-xs text-muted-foreground">{VERIFY_METHODS[g.method].name}</div>
                </div>
                <VerifyInfoButton method={g.method} gameName={g.name} />
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-3">
          <h2 className="text-sm font-bold text-foreground">2. Details</h2>
          <label className="text-xs font-semibold text-muted-foreground">
            League name
            <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted-foreground">
              Starts
              <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground" />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">
              Ends
              <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground" />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">Between 1 hour and 30 days.</p>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold text-foreground">3. Prize split</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(payout === "winner")} onClick={() => setPayout("winner")}>Winner takes all</button>
            <button type="button" className={chip(payout === "top3")} onClick={() => setPayout("top3")}>Top 3: 50 / 30 / 20</button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Places with no player go back to you.</p>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold text-foreground">4. Prize currency</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(token === "nim")} onClick={() => setToken("nim")}>NIM</button>
            <button type="button" className={chip(token === "usdt")} onClick={() => setToken("usdt")}>USDT (Polygon)</button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">You'll fund the pool on the next screen. Anyone can add more later.</p>
        </section>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        <button
          type="button"
          disabled={busy || !player || name.trim().length < 3}
          onClick={submit}
          className="mt-6 min-h-11 w-full rounded-full bg-primary px-4 text-sm font-black uppercase text-primary-foreground disabled:opacity-50"
        >
          {!player ? "Connect your wallet first" : busy ? "Creating…" : "Create and fund"}
        </button>
      </div>
    </main>
  );
}
