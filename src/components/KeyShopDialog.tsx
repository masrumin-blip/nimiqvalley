import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, MessageCircle } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCreditActions, useCredits, type PayToken, type PurchaseResult } from "@/hooks/useCredits";
import { CHAT_PACKS, KEY_COST_NIM } from "@/lib/credits";
import { getOpenPurchase, getShopPrices } from "@/lib/credits.functions";

type KeyPack = { id: string; keys: number; label: string; note: string };

const KEY_PACKS: KeyPack[] = [
  { id: "single", keys: 1, label: "Single key", note: "One online match" },
  { id: "squad", keys: 3, label: "Squad pack", note: "Three online matches" },
  { id: "season", keys: 10, label: "Season pack", note: "Ten online matches" },
];

export type ShopTab = "keys" | "chat";

const usdtFor = (nim: number, usd: number) => Math.max(0.0001, Math.ceil(nim * usd * 10_000) / 10_000);

/** Shop for match keys and AI chat messages, paid in NIM or USDT (Polygon). */
export function KeyShopDialog({
  className = "",
  initialTab = "keys",
  trigger,
}: {
  className?: string;
  initialTab?: ShopTab;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ShopTab>(initialTab);
  const [token, setToken] = useState<PayToken>("nim");
  const [hash, setHash] = useState("");
  const [cooldown, setCooldown] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { credits } = useCredits();
  const { buyKeys, buyChatPack, recheck, phase, lastId } = useCreditActions();

  const loadPrices = useServerFn(getShopPrices);
  const loadOpen = useServerFn(getOpenPurchase);
  const prices = useQuery({ queryKey: ["shop-prices"], queryFn: () => loadPrices(), enabled: open, staleTime: 60_000 });
  const openPurchase = useQuery({ queryKey: ["open-purchase"], queryFn: () => loadOpen(), enabled: open, staleTime: 5_000 });
  const usd = prices.data?.nimUsd ?? 0;
  const usdtOff = token === "usdt" && !usd;

  const busy = buyKeys.isPending || buyChatPack.isPending || recheck.isPending;
  const active = tab === "keys" ? buyKeys : buyChatPack;
  const recoverId = lastId ?? openPurchase.data?.id ?? null;
  const recoverToken = (openPurchase.data?.id === recoverId ? openPurchase.data?.token : token) as PayToken;

  const price = (nim: number) => (token === "nim" ? `${nim} NIM` : usd ? `${usdtFor(nim, usd)} USDT` : "—");

  const report = (r: PurchaseResult) => {
    void openPurchase.refetch();
    setNote(
      r.status === "confirmed"
        ? "Done! Added to your balance."
        : "Payment recorded. We are checking the network. It will be added automatically, once, even if you leave this page.",
    );
  };

  const doRecheck = () => {
    if (!recoverId) return;
    if (recoverToken === "usdt" && !/^0x[0-9a-fA-F]{64}$/.test(hash.trim())) {
      return setNote("Paste the full Polygon transaction hash starting with 0x.");
    }
    setNote(null);
    recheck.mutate(
      { id: recoverId, ...(recoverToken === "usdt" ? { txHash: hash.trim() } : {}) },
      {
        onSuccess: (r) => {
          setHash("");
          report(r);
        },
        onError: (e) => setNote((e as Error).message),
        onSettled: () => {
          setCooldown(true);
          setTimeout(() => setCooldown(false), 10_000);
        },
      },
    );
  };

  const tabBtn = (id: ShopTab, label: string, Icon: typeof KeyRound) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
        tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
      }`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setTab(initialTab);
          setNote(null);
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            className={`rounded-full text-xs font-black uppercase tracking-wide ${className}`}
            size="sm"
          >
            <KeyRound className="size-4" aria-hidden="true" />
            Key shop
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Shop</DialogTitle>
          <DialogDescription>Pay with NIM or USDT (Polygon). Both cost the same.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
          {tabBtn("keys", "Match keys", KeyRound)}
          {tabBtn("chat", "AI chat", MessageCircle)}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Pay with</span>
          <div className="flex gap-1 rounded-full bg-muted/50 p-1">
            {(["nim", "usdt"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setToken(t)}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  token === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {token === "usdt" && (
          <p className="text-[11px] text-muted-foreground">
            {usd
              ? `Priced at today's NIM rate (1 NIM ≈ $${usd.toFixed(6)}). The price is fixed when you tap buy.`
              : prices.isLoading
                ? "Loading today's price…"
                : "USDT prices are unavailable right now. Please pay with NIM."}
          </p>
        )}

        {tab === "keys" ? (
          <>
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">What is a match key for?</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                <li>1 key starts a quick match against a real player.</li>
                <li>1 key creates a private room you can share by code.</li>
                <li>Joining a friend&apos;s room by code is always free.</li>
                <li>Cancel the search before a match is found and the key comes back.</li>
              </ul>
            </div>
            <div className="space-y-2">
              {KEY_PACKS.map((pack) => (
                <ShopItem
                  key={pack.id}
                  title={`${pack.keys} ${pack.keys === 1 ? "key" : "keys"} · ${pack.label}`}
                  sub={pack.note}
                  price={price(pack.keys * KEY_COST_NIM)}
                  disabled={busy || usdtOff}
                  onClick={() => {
                    setNote(null);
                    buyKeys.mutate({ keys: pack.keys, token }, { onSuccess: report });
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            {CHAT_PACKS.map((pack) => (
              <ShopItem
                key={pack.id}
                title={pack.label}
                sub={`${pack.chats} AI chat messages`}
                price={price(pack.nim)}
                disabled={busy || usdtOff}
                onClick={() => {
                  setNote(null);
                  buyChatPack.mutate({ pack, token }, { onSuccess: report });
                }}
              />
            ))}
          </div>
        )}

        {active.isPending && (
          <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            {phase === "confirming"
              ? "Checking the network… you can leave this page, it will be added once."
              : "Approve the payment in your wallet…"}
          </p>
        )}
        {active.isError && !active.isPending && (
          <p className="text-center text-xs text-destructive">
            {(active.error as Error)?.message ?? "The purchase did not go through."}
          </p>
        )}
        {note && <p className="text-center text-xs text-primary">{note}</p>}

        {recoverId && !active.isPending && (
          <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
            <p className="text-[11px] text-muted-foreground">
              Paid but nothing was added? Check again. A payment is only ever counted once.
            </p>
            {recoverToken === "usdt" && (
              <input
                value={hash}
                onChange={(e) => setHash(e.target.value)}
                placeholder="Polygon transaction hash (0x…)"
                className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
              />
            )}
            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              disabled={busy || cooldown}
              onClick={doRecheck}
            >
              {recheck.isPending ? <Loader2 className="size-3 animate-spin" /> : null}
              I already paid, check again
            </Button>
          </div>
        )}

        {credits && (
          <p className="text-center text-[11px] text-muted-foreground">
            {credits.matchKeys} match {credits.matchKeys === 1 ? "key" : "keys"} ·{" "}
            {credits.freeChatsLeft} free chats today · {credits.chatCredits} bought chats
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ShopItem({
  title,
  sub,
  price,
  disabled,
  onClick,
}: {
  title: string;
  sub: string;
  price: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-3 text-left transition-colors hover:bg-accent disabled:opacity-60"
    >
      <span>
        <span className="block text-sm font-bold text-card-foreground">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{sub}</span>
      </span>
      <span className="font-mono text-sm font-black text-primary">{price}</span>
    </button>
  );
}
