import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { PlayerBadge } from "@/components/PlayerBadge";
import { VerifyInfoButton } from "@/components/VerifyInfoButton";
import { shortWallet } from "@/lib/leaderboard";
import { claimPrize, deleteLeague, fundLeague, getLeague, getTreasury, recheckLeagueDeposit } from "@/lib/leagues.functions";
import { LEAGUE_GAMES, PAYOUT_SHARES, VERIFY_METHODS, leaguePhase } from "@/lib/verification-info";
import { payNim, sendUsdtPolygon } from "@/lib/wallet";

const title = "League — NimiqValley";
const description = "Live standings, countdown, and prize pool for a NimiqValley league.";

export const Route = createFileRoute("/leagues/$id")({
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
  component: LeagueDetail,
});

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d ? `${d}d ` : ""}${h}h ${m}m ${s % 60}s`;
}

function LeagueDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchLeague = useServerFn(getLeague);
  const fetchTreasury = useServerFn(getTreasury);
  const fund = useServerFn(fundLeague);
  const claim = useServerFn(claimPrize);
  const recheck = useServerFn(recheckLeagueDeposit);
  const del = useServerFn(deleteLeague);
  const now = useNow();
  const { data, isLoading } = useQuery({ queryKey: ["league", id], queryFn: () => fetchLeague({ data: { id } }), refetchInterval: (q) => (q.state.data?.myPending?.some((p) => p.status === "pending") ? 5_000 : 15_000) });
  const { data: treasury } = useQuery({ queryKey: ["league-treasury"], queryFn: () => fetchTreasury() });
  const [amount, setAmount] = useState("");
  const [recoveryHash, setRecoveryHash] = useState("");
  const [polyAddr, setPolyAddr] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  if (isLoading) return <main className="min-h-screen bg-background p-6 text-sm text-muted-foreground">Loading…</main>;
  if (!data) return <main className="min-h-screen bg-background p-6 text-sm text-muted-foreground">League not found.</main>;

  const l = data.league;
  const game = LEAGUE_GAMES.find((g) => g.slug === l.gameSlug);
  const phase = leaguePhase(l);
  const start = new Date(l.startsAt).getTime();
  const end = new Date(l.endsAt).getTime();
  const canFund = now < end && (l.status !== "draft" || data.me === l.creatorWallet);
  const shares = PAYOUT_SHARES[l.payout];

  const doFund = async () => {
    const amt = Number(amount);
    if (!(amt > 0)) return setMsg("Enter an amount.");
    setBusy(true);
    setMsg(null);
    try {
      let txHash: string | undefined;
      if (l.token === "nim") {
        if (!treasury?.nim) throw new Error("League deposits are not open yet.");
        setMsg("Approve the payment in your wallet…");
        txHash = await payNim(treasury.nim, amt, `NimiqValley league ${l.id.slice(0, 8)}`);
      } else {
        if (!treasury?.polygon) throw new Error("League deposits are not open yet.");
        setMsg("Approve the USDT transfer in your wallet…");
        txHash = (await sendUsdtPolygon(treasury.polygon, amt)).hash;
      }
      setMsg("Payment sent. Recording it — you can leave this page safely…");
      const r = await fund({ data: { id: l.id, amount: amt, txHash } });
      setMsg(
        r.status === "confirmed"
          ? `Added! Pool is now ${r.pool} ${l.token.toUpperCase()}.`
          : "Payment recorded. We are checking the network, and it will be added automatically even if you leave.",
      );
      setAmount("");
      void qc.invalidateQueries({ queryKey: ["league", id] });
      void qc.invalidateQueries({ queryKey: ["leagues"] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Payment failed.");
    } finally {
      setBusy(false);
    }
  };

  const doRecheck = async () => {
    const amt = Number(amount);
    if (!(amt > 0)) return setMsg("Enter the amount you already sent, then tap check.");
    if (l.token === "usdt" && !/^0x[0-9a-fA-F]{64}$/.test(recoveryHash.trim())) {
      return setMsg("Enter the complete Polygon transaction hash beginning with 0x.");
    }
    setBusy(true);
    setMsg(l.token === "nim" ? "Searching the Nimiq network for your payment…" : "Checking your Polygon payment…");
    try {
      const r = await recheck({ data: { id: l.id, amount: amt, txHash: l.token === "usdt" ? recoveryHash.trim() : undefined } });
      setMsg(r.status === "confirmed" ? `Found it! Pool is now ${r.pool} ${l.token.toUpperCase()}.` : "Payment recorded and is being confirmed. You can leave this page safely.");
      setAmount("");
      setRecoveryHash("");
      void qc.invalidateQueries({ queryKey: ["league", id] });
      void qc.invalidateQueries({ queryKey: ["leagues"] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Check failed.");
    } finally {
      setBusy(false);
      setCooldown(true);
      setTimeout(() => setCooldown(false), 10_000);
    }
  };

  const doClaim = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await claim({ data: { id: l.id, polygonAddress: l.token === "usdt" ? polyAddr.trim() : undefined } });
      setMsg(r.status === "paid" ? `Sent ${r.amount} ${l.token.toUpperCase()}!` : `Claim recorded: ${r.amount} ${l.token.toUpperCase()} will be sent to you shortly.`);
      void qc.invalidateQueries({ queryKey: ["league", id] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Claim failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-2">
          <Link to="/leagues" className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground hover:bg-accent">
            ← Leagues
          </Link>
          <PlayerBadge />
        </div>

        <div className="arcade-panel mt-5 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${phase === "Live" ? "animate-pulse bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {phase === "Live" ? "● Live" : phase}
            </span>
            <span className="arcade-label">Scoreboard</span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-tight text-foreground sm:text-4xl">{l.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{game?.name}</span>
            {game && (
              <>
                <span>· {VERIFY_METHODS[game.method].name}</span>
                <VerifyInfoButton method={game.method} gameName={game.name} />
              </>
            )}
          </div>

          <div className="mt-4 text-center">
            <div className="arcade-label">Prize pool</div>
            <div className="arcade-glow font-mono text-5xl font-black tabular-nums text-primary">
              {l.pool} <span className="text-lg">{l.token.toUpperCase()}</span>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background/60 p-3">
              <div className="arcade-label">{now < start ? "Starts in" : now < end ? "Ends in" : "Status"}</div>
              <div className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">
                {now < start ? fmt(start - now) : now < end ? fmt(end - now) : "Finished"}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background/60 p-3">
              <div className="arcade-label">Split</div>
              <div className="mt-1 font-mono text-sm font-bold text-foreground">
                {shares.map((s, i) => `#${i + 1} ${Math.round(s * 100)}%`).join(" · ")}
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-foreground">
            <span className="font-black uppercase text-primary">🏆 Host </span>
            Created by <b>{l.creatorName || `${l.creatorWallet.slice(0, 14)}…`}</b> — thanks for sponsoring this league!
          </div>

          {phase === "Live" && game && (
            <a href={`${game.path}?league=${l.id}`} className="arcade-btn mt-4 flex min-h-12 w-full px-4 text-sm">
              ▶ Play in this league
            </a>
          )}
        </div>

        {l.status === "draft" && (
          <div className="mt-4 rounded-xl border border-border bg-card p-3">
            <p className="text-sm text-muted-foreground">
              This league is only visible to you until the prize pool is funded. After funding, the terms are locked.
            </p>
            {data.me === l.creatorWallet && l.pool === 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm("Delete this league? This cannot be undone.")) return;
                  setBusy(true);
                  setMsg(null);
                  try {
                    await del({ data: { id: l.id } });
                    void qc.invalidateQueries({ queryKey: ["leagues"] });
                    void navigate({ to: "/leagues" });
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : "Delete failed.");
                    setBusy(false);
                  }
                }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-destructive px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" aria-hidden="true" /> Delete league
              </button>
            )}
          </div>
        )}

        {canFund && (
          <section className="mt-4 rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold text-foreground">Add to prize pool</h2>
            <p className="mt-1 text-xs text-muted-foreground">Deposits can't be withdrawn.</p>
            <div className="mt-2 flex gap-2">
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Amount in ${l.token.toUpperCase()}`}
                className="min-h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
              />
              <button type="button" disabled={busy} onClick={doFund} className="rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
                Fund
              </button>
            </div>
            {l.token === "usdt" && (
              <input
                value={recoveryHash}
                onChange={(e) => setRecoveryHash(e.target.value)}
                placeholder="Polygon transaction hash (0x…)"
                className="mt-2 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
              />
            )}
            <button type="button" disabled={busy || cooldown || (l.token === "usdt" && !recoveryHash.trim())} onClick={doRecheck} className="mt-2 text-xs font-semibold text-primary underline disabled:opacity-50">
              I already paid, check again
            </button>
          </section>
        )}

        {data.myPending.filter((p) => p.status === "pending").map((p) => {
          const waited = Math.max(0, Math.floor((now - new Date(p.createdAt).getTime()) / 1000));
          return (
            <section key={p.createdAt} className="mt-4 rounded-2xl border border-primary bg-primary/10 p-4">
              <h2 className="text-sm font-bold text-foreground">Your payment is being confirmed ({p.amount} {l.token.toUpperCase()})</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Checking the network (waiting {Math.floor(waited / 60)}m {waited % 60}s). Once detected, it is added immediately and only once — you can leave this page.
              </p>
            </section>
          );
        })}
        {data.myPending.filter((p) => p.status === "failed").slice(0, 1).map((p) => (
          <p key={p.createdAt} className="mt-4 rounded-xl border border-destructive p-3 text-xs text-destructive">
            A payment of {p.amount} {l.token.toUpperCase()} could not be matched (wrong amount, sender, or recipient). If you are sure it was sent, tap "I already paid, check again".
          </p>
        ))}

        {data.myShare && (
          <section className="mt-4 rounded-2xl border border-primary bg-primary/10 p-4">
            <h2 className="text-sm font-bold text-foreground">Your prize: {data.myShare.amount} {l.token.toUpperCase()}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {l.token === "usdt"
                ? "USDT prizes are sent automatically to the Polygon address you enter, usually within a minute."
                : "NIM prizes are sent to your connected Nimiq wallet by the platform team after you claim — usually within 24 hours."}
            </p>
            {data.myClaim ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {data.myClaim.status === "paid" ? `Paid · ${data.myClaim.txHash?.slice(0, 12)}…` : "Claimed — payment pending."}
              </p>
            ) : (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                {l.token === "usdt" && (
                  <input value={polyAddr} onChange={(e) => setPolyAddr(e.target.value)} placeholder="Your Polygon address 0x…" className="min-h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm text-foreground" />
                )}
                <button type="button" disabled={busy} onClick={doClaim} className="min-h-11 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
                  Claim prize
                </button>
              </div>
            )}
          </section>
        )}

        {msg && <p className="mt-3 text-sm text-foreground">{msg}</p>}

        <section className="arcade-panel mt-6 overflow-hidden">
          <div className="border-b border-border px-4 py-3 text-center">
            <span className="arcade-label">— High scores —</span>
          </div>
          <div className="grid grid-cols-[3rem_1fr_6rem] gap-2 border-b border-border px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>Rank</span><span>Player</span><span className="text-right">Best</span>
          </div>
          {data.rows.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">No scores yet. Be the first!</p>}
          {data.rows.map((r) => {
            const medal = r.rank === 1 ? "text-neon-yellow" : r.rank === 2 ? "text-foreground/80" : r.rank === 3 ? "text-neon-orange" : "text-muted-foreground";
            const rowBg = r.wallet === data.me ? "bg-primary/15 font-bold ring-1 ring-inset ring-primary" : r.rank <= 3 ? "bg-primary/5" : "";
            return (
              <div key={r.wallet} className={`grid grid-cols-[3rem_1fr_6rem] items-center gap-2 border-b border-border/50 px-4 py-2.5 text-sm last:border-0 ${rowBg}`}>
                <span className={`font-mono font-black ${medal}`}>{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : String(r.rank).padStart(2, "0")}</span>
                <span className="truncate text-foreground">{r.displayName || shortWallet(r.wallet)}</span>
                <span className={`text-right font-mono font-black tabular-nums ${r.rank <= 3 ? "text-primary" : "text-foreground"}`}>{r.best}</span>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
