import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import PostOfficeDialog from "@/components/PostOfficeDialog";
import LetterPopup from "@/components/LetterPopup";
import { fetchInbox, fetchLetter, openLetter } from "@/lib/letters.functions";
import type { Letter } from "@/lib/letters";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlayer } from "@/hooks/usePlayer";
import VillageCanvas from "@/components/VillageCanvas";
import Joystick from "@/components/Joystick";
import GameStage from "@/components/GameStage";
import SceneryView from "@/components/SceneryView";
import { Button } from "@/components/ui/button";

import { getNimBalance, getNimPrice } from "@/lib/nimiq.functions";
import { connectPolygon, getConnectedPolygonAccount, getEthereum, isInsideNimiqPay, readUsdtBalance, sendNim } from "@/lib/wallet";
import { formatNim, formatUsd, MIN_NIM_RESERVE, TIERS, tierForUsd } from "@/lib/tiers";
import type { Neighbor, RestSpot } from "@/lib/village";

export const Route = createFileRoute("/village")({
  head: () => ({
    meta: [
      { title: "Nimiq Island — An Interactive Portfolio Village" },
      {
        name: "description",
        content: "An interactive portfolio shaped like a village — explore it and see the views inside.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { letter?: string } => {
    const l = search["letter"];
    return typeof l === "string" && /^[0-9a-f-]{36}$/i.test(l) ? { letter: l } : {};
  },
  component: VillagePage,
});

function PostOffice({ wallet, near, badgeRef }: { wallet: string | null; near: boolean; badgeRef: React.MutableRefObject<number> }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { letter: letterId } = Route.useSearch();
  const inboxFn = useServerFn(fetchInbox);
  const letterFn = useServerFn(fetchLetter);
  const openFn = useServerFn(openLetter);
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState<Letter | null>(null);

  const inbox = useQuery({
    queryKey: ["inbox", wallet],
    enabled: Boolean(wallet),
    queryFn: () => inboxFn(),
    refetchInterval: 60_000,
  });
  const letters = inbox.data ?? [];
  const unread = letters.filter((l) => !l.openedAt).length;
  useEffect(() => {
    badgeRef.current = unread;
  }, [unread, badgeRef]);

  const shared = useQuery({
    queryKey: ["letter", letterId, wallet],
    enabled: Boolean(letterId && wallet),
    queryFn: () => letterFn({ data: { id: letterId as string } }),
    retry: false,
  });

  const closeShared = () => navigate({ to: "/village", search: {}, replace: true });
  const markOpened = (id: string) => {
    void openFn({ data: { id } }).then(() => qc.invalidateQueries({ queryKey: ["inbox"] }));
  };

  return (
    <>
      {near && (
        <div className="absolute bottom-24 right-4 z-30">
          <Button onClick={() => setOpen(true)} className="relative min-h-11 rounded-xl px-5 text-sm font-semibold shadow-lg">
            <Mail className="size-4" /> Post Office
            {unread > 0 && (
              <span className="absolute -right-2 -top-2 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[11px] text-destructive-foreground">
                {unread}
              </span>
            )}
          </Button>
        </div>
      )}
      <PostOfficeDialog open={open} onOpenChange={setOpen} inbox={letters} onRead={(l) => setReading(l)} />
      {reading && <LetterPopup letter={reading} onOpened={markOpened} onClose={() => setReading(null)} />}
      {letterId && !wallet && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
          <div className="max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
            <p className="text-lg font-semibold">You've got a letter!</p>
            <p className="mt-1 text-sm text-muted-foreground">Connect your Nimiq wallet to open it.</p>
            <Button onClick={closeShared} variant="outline" className="mt-4 min-h-11 w-full">Close</Button>
          </div>
        </div>
      )}
      {letterId && wallet && shared.isFetched && (
        <LetterPopup
          letter={shared.data?.letter ?? null}
          notForYou={shared.data ? !shared.data.forYou : false}
          onOpened={markOpened}
          onClose={closeShared}
        />
      )}
    </>
  );
}

function VillagePage() {
  const { player } = usePlayer();
  const moveRef = useRef({ x: 0, y: 0 });
  const [nimAddress, setNimAddress] = useState<string | null>(null);
  const [evmAddress, setEvmAddress] = useState<string | null>(null);
  const [nearby, setNearby] = useState<Neighbor | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("1");
  const [sendOpen, setSendOpen] = useState(false);
  const [demo, setDemo] = useState(false);
  const [demoTier, setDemoTier] = useState(1);
  const [demoHouseTier, setDemoHouseTier] = useState(1);
  const [nearbyViewpoint, setNearbyViewpoint] = useState<RestSpot | null>(null);
  const [activeViewpoint, setActiveViewpoint] = useState<RestSpot | null>(null);
  const [nearPost, setNearPost] = useState(false);
  const postBadgeRef = useRef(0);
  const { letter: sharedLetter } = Route.useSearch();

  const priceFn = useServerFn(getNimPrice);
  const balanceFn = useServerFn(getNimBalance);

  const price = useQuery({
    queryKey: ["nim-price"],
    queryFn: () => priceFn(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const nimBalance = useQuery({
    queryKey: ["nim-balance", nimAddress],
    enabled: Boolean(nimAddress),
    queryFn: () => balanceFn({ data: { address: nimAddress as string } }),
    refetchInterval: 30_000,
  });

  const usdt = useQuery({
    queryKey: ["usdt-balance", evmAddress],
    enabled: Boolean(evmAddress),
    queryFn: () => readUsdtBalance(evmAddress as string),
    refetchInterval: 60_000,
  });

  const DEMO_USD = [2, 7, 25, 120];
  const demoNimUsd = DEMO_USD[demoTier] ?? DEMO_USD[0] ?? 0;
  const demoUsdt = DEMO_USD[demoHouseTier] ?? DEMO_USD[0] ?? 0;
  const nim = demo ? demoNimUsd * 250 : (nimBalance.data?.nim ?? 0);
  const nimUsd = demo ? demoNimUsd : nim * (price.data?.usd ?? 0);
  const usdtValue = demo ? demoUsdt : (usdt.data ?? 0);
  const realCharTier = useMemo(() => tierForUsd(nimUsd), [nimUsd]);
  const realHouseTier = useMemo(() => tierForUsd(usdtValue), [usdtValue]);
  const charTier = demo ? (TIERS[demoTier] ?? realCharTier) : realCharTier;
  const houseTier = demo ? (TIERS[demoHouseTier] ?? realHouseTier) : realHouseTier;

  const onNearbyChange = useCallback((n: Neighbor | null) => {
    setNearby(n);
    if (!n) setSendOpen(false);
  }, []);
  const onViewpointChange = useCallback((spot: RestSpot | null) => {
    setNearbyViewpoint(spot);
  }, []);

  const closeScenery = useCallback(() => {
    moveRef.current = { x: 0, y: 0 };
    setActiveViewpoint(null);
  }, []);

  // The player already signed in with their wallet at the start of the app,
  // so reuse that address instead of asking for another connection.
  useEffect(() => {
    if (player?.wallet) setNimAddress(player.wallet);
  }, [player?.wallet]);

  // Read only an already-authorized Polygon account; loading the island must not open an approval dialog.
  useEffect(() => {
    if (!nimAddress || evmAddress) return;
    if (!isInsideNimiqPay() || !getEthereum()) return;
    let cancelled = false;
    void getConnectedPolygonAccount()
      .then((addr) => {
        if (!cancelled) setEvmAddress(addr);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [nimAddress, evmAddress]);

  const handleConnectPolygon = async () => {
    setStatus(null);
    try {
      setEvmAddress(await connectPolygon());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Polygon was not connected.");
    }
  };

  const amountNum = Number(amount);
  const wouldLeave = nim - (Number.isFinite(amountNum) ? amountNum : 0);
  const blockedByReserve = wouldLeave < MIN_NIM_RESERVE;

  const handleSend = async () => {
    if (!nearby) return;
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setStatus("Enter an amount greater than zero.");
      return;
    }
    if (blockedByReserve) {
      setStatus(`Sending stops here — you must keep at least ${MIN_NIM_RESERVE} NIM in your wallet.`);
      return;
    }
    if (demo) {
      setStatus(`Demo only — no real NIM was sent to ${nearby.name}.`);
      setSendOpen(false);
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const hash = await sendNim(nearby.address, amountNum);
      setStatus(`Sent ${formatNim(amountNum)} to ${nearby.name}. Tx ${hash.slice(0, 10)}…`);
      setSendOpen(false);
      void nimBalance.refetch();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "The transaction was not completed.");
    } finally {
      setBusy(false);
    }
  };


  return (
    <GameStage>
      <main className="relative h-full w-full overflow-hidden bg-background">
      <h1 className="sr-only">Nimiq Island — an island village with six interactive scenic views</h1>

      <Link
        to="/"
        aria-label="Back to main menu"
        className="absolute right-3 top-3 z-40 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur transition-colors hover:bg-accent"
      >
        ← Menu
      </Link>

      <div className="absolute inset-0">
        <VillageCanvas
          characterTier={charTier.id}
          houseTier={houseTier.id}
          moveRef={moveRef}
          onNearbyChange={onNearbyChange}
          onViewpointChange={onViewpointChange}
          paused={Boolean(activeViewpoint)}
          onPostOfficeChange={setNearPost}
          postBadgeRef={postBadgeRef}
          spawnAtPostOffice={Boolean(sharedLetter)}
        />
      </div>


      {/* Status panel, enlarged by 15% while keeping the menu in its own corner. */}
      <div className="pointer-events-none absolute left-0 top-0 z-30 origin-top-left scale-[0.69] p-3">
        <div className="pointer-events-auto w-[430px] max-w-[92vw] rounded-2xl border border-border/60 bg-card/85 p-3 shadow-lg backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Villager
              </p>
              <p className="text-sm font-semibold text-card-foreground">{charTier.characterName}</p>
              <p className="text-xs text-muted-foreground">
                {demo
                  ? `Demo · ${formatUsd(nimUsd)}`
                  : nimAddress
                    ? `${formatNim(nim)} · ${formatUsd(nimUsd)}`
                    : "Loading balance…"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Home
              </p>
              <p className="text-sm font-semibold text-card-foreground">{houseTier.houseName}</p>
              <p className="text-xs text-muted-foreground">
                {demo || evmAddress ? `${formatUsd(usdtValue)} USDT` : "Polygon not connected"}
              </p>
              {!demo && !evmAddress && getEthereum() ? (
                <Button type="button" variant="ghost" onClick={handleConnectPolygon} className="mt-1 min-h-11 px-2 text-xs">
                  Connect Polygon
                </Button>
              ) : null}
            </div>

            {/* Real token balances */}
            <div className="rounded-xl border border-orange-400/70 bg-orange-50/90 px-2.5 py-1.5 text-right shadow-sm dark:bg-orange-950/40 dark:border-orange-500/50">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-300">
                Wallet
              </p>
              <p className="text-xs font-bold text-foreground">
                {demo ? "Demo" : nimAddress ? `${nim.toLocaleString()} NIM` : "— NIM"}
              </p>
              <p className="text-xs font-bold text-foreground">
                {demo ? "Demo" : evmAddress ? `${usdtValue.toLocaleString()} USDT` : "— USDT"}
              </p>
            </div>
          </div>
          {demo && (
            <div className="mt-3 space-y-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Demo villager level
                </p>
                <div className="mt-1 flex gap-1">
                  {TIERS.map((t, i) => (
                    <Button
                      key={t.id}
                      onClick={() => setDemoTier(i)}
                      className={`min-h-9 flex-1 rounded-lg px-1 text-[11px] font-semibold ${
                        i === demoTier
                          ? "bg-primary text-primary-foreground"
                          : "border border-input bg-background text-foreground"
                      }`}
                    >
                      {t.characterName.split(" ")[0]}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Demo home level
                </p>
                <div className="mt-1 flex gap-1">
                  {TIERS.map((t, i) => (
                    <Button
                      key={t.id}
                      onClick={() => setDemoHouseTier(i)}
                      className={`min-h-9 flex-1 rounded-lg px-1 text-[11px] font-semibold ${
                        i === demoHouseTier
                          ? "bg-primary text-primary-foreground"
                          : "border border-input bg-background text-foreground"
                      }`}
                    >
                      {t.houseName.split(" ")[0]}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <Button
            onClick={() => setDemo((v) => !v)}
            className="mt-2 min-h-9 w-full rounded-lg border border-input bg-background text-[11px] font-semibold text-foreground"
          >
            {demo ? "Leave demo mode" : "Try demo mode"}
          </Button>
          {status && <p className="mt-2 text-xs text-card-foreground/80">{status}</p>}
        </div>
      </div>


      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
        <Joystick moveRef={moveRef} disabled={Boolean(activeViewpoint)} />
        <div className="flex flex-col items-end gap-2">
          {nearbyViewpoint && !activeViewpoint && (
            <Button
              onClick={() => {
                moveRef.current = { x: 0, y: 0 };
                setActiveViewpoint(nearbyViewpoint);
              }}
              className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg"
            >
              View scenery · {nearbyViewpoint.name}
            </Button>
          )}
          {nearby && !sendOpen && (
            <Button
              onClick={() => setSendOpen(true)}
              className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg"
            >
              Send NIM to {nearby.name.split(" ")[0]}
            </Button>
          )}
          <p className="rounded-lg bg-card/70 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
            Drag the pad or use WASD / arrows
          </p>
        </div>
      </div>

      {/* Send panel (docked, not a pop-up) */}
      {sendOpen && nearby && (
        <div className="absolute inset-x-0 bottom-0 z-30 p-3">
          <div className="w-full rounded-2xl border border-border bg-card p-4 shadow-lg">
            <h2 className="text-lg font-semibold text-card-foreground">Send NIM to {nearby.name}</h2>
            <p className="mt-1 break-all text-xs text-muted-foreground">{nearby.address}</p>
            <label className="mt-3 block text-xs font-medium text-muted-foreground" htmlFor="amt">
              Amount (NIM)
            </label>
            <input
              id="amt"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Balance {formatNim(nim)} · at least {MIN_NIM_RESERVE} NIM must stay in your wallet.
            </p>
            {blockedByReserve && (
              <p className="mt-1 text-xs text-destructive">
                Too much — this would leave less than {MIN_NIM_RESERVE} NIM.
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <Button
                onClick={() => setSendOpen(false)}
                className="min-h-11 flex-1 rounded-xl border border-input bg-background text-sm font-semibold text-foreground"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={busy || blockedByReserve || (!nimAddress && !demo)}
                className="min-h-11 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Waiting…" : demo ? "Send (demo)" : "Send"}
              </Button>
            </div>
            {!nimAddress && !demo && (
              <p className="mt-2 text-xs text-destructive">Connect your Nimiq wallet first.</p>
            )}
            {demo && (
              <p className="mt-2 text-xs text-muted-foreground">
                Demo mode — nothing real leaves a wallet.
              </p>
            )}
          </div>
        </div>
      )}
      <PostOffice wallet={player?.wallet ?? null} near={nearPost && !activeViewpoint} badgeRef={postBadgeRef} />
      {activeViewpoint && <SceneryView spot={activeViewpoint} onClose={closeScenery} />}
      </main>
    </GameStage>
  );
}

