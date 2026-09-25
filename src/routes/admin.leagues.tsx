import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { WalletGate } from "@/components/WalletGate";
import { adminOverview, getAdminStatus, markNimPayoutPaid, retryUsdtPayout, type AdminPayout } from "@/lib/admin.functions";
import { payNim } from "@/lib/wallet";

export const Route = createFileRoute("/admin/leagues")({
  head: () => ({
    meta: [
      { title: "Admin — League Payouts" },
      { name: "description", content: "Private payout desk for league prizes." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Admin — League Payouts" },
      { property: "og:description", content: "Private payout desk for league prizes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <WalletGate name="Admin">
      <AdminPage />
    </WalletGate>
  ),
});

function txLink(token: string, hash: string) {
  return token === "usdt" ? `https://polygonscan.com/tx/${hash}` : `https://nimiq.watch/#${hash}`;
}

function AdminPage() {
  const status = useServerFn(getAdminStatus);
  const overview = useServerFn(adminOverview);
  const markPaid = useServerFn(markNimPayoutPaid);
  const retry = useServerFn(retryUsdtPayout);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const s = useQuery({ queryKey: ["admin-status"], queryFn: () => status() });
  const o = useQuery({ queryKey: ["admin-overview"], queryFn: () => overview(), enabled: s.data?.isAdmin === true });

  if (s.isLoading) return <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>;
  if (!s.data?.isAdmin)
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">No access.</p>
        <Link to="/games" className="mt-3 inline-block text-xs underline text-muted-foreground">Back to Game Hub</Link>
      </div>
    );

  const run = async (p: AdminPayout) => {
    setBusy(p.id);
    setMsg(null);
    try {
      if (p.token === "nim") {
        await payNim(p.toAddress, p.amount, `League prize ${p.leagueTitle}`.slice(0, 60));
        setMsg("Sent. Checking the blockchain…");
        await markPaid({ data: { id: p.id } });
      } else {
        await retry({ data: { id: p.id } });
      }
      setMsg("Paid.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(null);
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    }
  };

  const recheck = async (p: AdminPayout) => {
    setBusy(p.id);
    try {
      await markPaid({ data: { id: p.id } });
      setMsg("Paid.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(null);
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    }
  };

  const d = o.data;
  return (
    <main className="mx-auto min-h-[100svh] max-w-4xl bg-background px-4 py-6 text-foreground">
      <Link to="/games" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-muted-foreground">
        <ArrowLeft className="size-3.5" /> Back to Game Hub
      </Link>
      <h1 className="font-display mt-3 text-2xl font-black uppercase">League payouts</h1>
      {d?.treasuryNim && <p className="mt-1 text-xs text-muted-foreground">Send NIM from treasury: {d.treasuryNim}</p>}

      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Active leagues", d?.activeLeagues ?? "—"],
          ["NIM in pools", d?.poolNim ?? "—"],
          ["USDT in pools", d?.poolUsdt ?? "—"],
          ["Waiting payment", d?.pending.length ?? "—"],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-2xl border border-border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
            <p className="text-xl font-black">{v}</p>
          </div>
        ))}
      </section>

      {msg && <p className="mt-3 text-sm">{msg}</p>}

      <h2 className="mt-6 text-sm font-bold uppercase">Waiting for payment</h2>
      <div className="mt-2 space-y-2">
        {d?.pending.length === 0 && <p className="text-sm text-muted-foreground">Nothing to pay.</p>}
        {d?.pending.map((p) => (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-3 text-sm">
            <p className="font-bold">{p.leagueTitle} · rank {p.ranks.join(", ") || "refund"}</p>
            <p className="text-muted-foreground">{p.amount} {p.token.toUpperCase()} → <span className="break-all">{p.toAddress}</span></p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" disabled={busy !== null} onClick={() => run(p)} className="min-h-10 rounded-full bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50">
                {busy === p.id ? "Working…" : p.token === "nim" ? "Pay" : "Retry send"}
              </button>
              {p.token === "nim" && (
                <button type="button" disabled={busy !== null} onClick={() => recheck(p)} className="min-h-10 rounded-full border border-border px-4 disabled:opacity-50">
                  Already sent? Check
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-6 text-sm font-bold uppercase">Paid</h2>
      <div className="mt-2 space-y-2">
        {d?.paid.map((p) => (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-3 text-sm">
            <p className="font-bold">{p.leagueTitle} · {p.amount} {p.token.toUpperCase()}</p>
            {p.txHash && (
              <a href={txLink(p.token, p.txHash)} target="_blank" rel="noreferrer" className="break-all text-xs underline text-muted-foreground">{p.txHash}</a>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
