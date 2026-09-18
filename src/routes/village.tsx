import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo, useRef, useState } from "react";
import VillageCanvas from "@/components/VillageCanvas";
import Joystick from "@/components/Joystick";
import GameStage from "@/components/GameStage";
import SceneryView from "@/components/SceneryView";
import { Button } from "@/components/ui/button";

import { getNimBalance, getNimPrice } from "@/lib/nimiq.functions";
import { connectNimiq, connectPolygon, getEthereum, isInsideNimiqPay, readUsdtBalance, sendNim } from "@/lib/wallet";
import { formatNim, formatUsd, MIN_NIM_RESERVE, TIERS, tierForUsd } from "@/lib/tiers";
import type { Neighbor, RestSpot } from "@/lib/village";

export const Route = createFileRoute("/village")({
  head: () => ({
    meta: [
      { title: "Nimiq Island — An Island Village with Interactive Scenery" },
      {
        name: "description",
        content:
          "Explore a pixel-art island village, meet villagers and animals, and unwind at six animated scenic spots.",
      },
      { property: "og:title", content: "Nimiq Island — An Island Village with Interactive Scenery" },
      {
        property: "og:description",
        content:
          "Explore a cozy island and discover six relaxing spots with animated scenery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VillagePage,
});

function VillagePage() {
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
  const charIndex = TIERS.findIndex((t) => t.id === charTier.id);
  const houseIndex = TIERS.findIndex((t) => t.id === houseTier.id);

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

  const handleConnectNimiq = async () => {
    setBusy(true);
    setStatus(null);
    try {
      setNimAddress(await connectNimiq());
      // In Nimiq Pay the Ethereum provider is bundled alongside the Nimiq provider,
      // so we automatically connect Polygon USDT after the Nimiq wallet is approved.
      if (isInsideNimiqPay() && getEthereum()) {
        try {
          setEvmAddress(await connectPolygon());
        } catch (err) {
          setStatus(err instanceof Error ? err.message : "Could not connect the Polygon wallet.");
        }
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not connect the Nimiq wallet.");
    } finally {
      setBusy(false);
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

  const connected = Boolean(nimAddress || evmAddress) || demo;

  return (
    <GameStage>
      <main className="relative h-full w-full overflow-hidden bg-background">
      <h1 className="sr-only">Nimiq Island — an island village with six interactive scenic views</h1>

      <Link
        to="/"
        aria-label="Back to main menu"
        className="absolute left-3 top-3 z-40 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur transition-colors hover:bg-accent"
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
        />
      </div>


      {/* Status HUD — always on top, same in demo and real mode */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 p-2">
        <div className="pointer-events-auto mx-auto w-full max-w-md rounded-2xl border border-border/60 bg-card/90 px-3 py-2 shadow-lg backdrop-blur">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-muted/50 px-2.5 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Villager
              </p>
              <p className="truncate text-sm font-bold text-card-foreground">
                {charTier.characterName}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {demo
                  ? `Demo · ${formatUsd(nimUsd)}`
                  : nimAddress
                    ? `${formatNim(nim)} · ${formatUsd(nimUsd)}`
                    : "Wallet not connected"}
              </p>
            </div>
            <div className="rounded-xl bg-muted/50 px-2.5 py-1.5 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Home
              </p>
              <p className="truncate text-sm font-bold text-card-foreground">
                {houseTier.houseName}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {demo || evmAddress ? `${formatUsd(usdtValue)} USDT` : "Polygon not connected"}
              </p>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Villager level
              </p>
              <div className="mt-1 flex gap-1">
                {TIERS.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={!demo}
                    onClick={() => setDemoTier(i)}
                    title={t.characterName}
                    aria-label={`Villager level ${t.characterName}`}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i <= charIndex ? "bg-primary" : "bg-border"
                    } ${demo ? "cursor-pointer" : "cursor-default"}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">
                Home level
              </p>
              <div className="mt-1 flex gap-1">
                {TIERS.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={!demo}
                    onClick={() => setDemoHouseTier(i)}
                    title={t.houseName}
                    aria-label={`Home level ${t.houseName}`}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i <= houseIndex ? "bg-primary" : "bg-border"
                    } ${demo ? "cursor-pointer" : "cursor-default"}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {demo && (
            <Button
              onClick={() => setDemo(false)}
              className="mt-2 h-8 w-full rounded-lg border border-input bg-background text-[11px] font-semibold text-foreground"
            >
              Leave demo mode
            </Button>
          )}
          {status && <p className="mt-2 text-xs text-card-foreground/80">{status}</p>}
        </div>
      </div>

      {/* Connect overlay */}
      {!connected && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background p-5">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-xl">
            <h2 className="text-xl font-semibold text-card-foreground">Welcome to the village</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your NIM decides how your villager looks. Your USDT on Polygon decides how grand your
              house is.
            </p>
            <div className="mt-5 space-y-2">
              <Button
                onClick={handleConnectNimiq}
                disabled={busy}
                className="min-h-11 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                Connect Nimiq wallet
              </Button>
              <Button
                onClick={() => {
                  setStatus(null);
                  setDemo(true);
                }}
                className="min-h-11 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-semibold text-foreground"
              >
                Try the demo — no wallet needed
              </Button>
            </div>
            {status && <p className="mt-3 text-xs text-destructive">{status}</p>}
            <p className="mt-4 text-xs text-muted-foreground">
              Works inside Nimiq Pay and in a normal browser with a wallet.
            </p>
          </div>
        </div>
      )}

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
      {activeViewpoint && <SceneryView spot={activeViewpoint} onClose={closeScenery} />}
      </main>
    </GameStage>
  );
}

