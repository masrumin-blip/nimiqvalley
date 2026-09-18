import { HexamanGame } from "@/games/hexaman/components/HexamanGame";

function Index() {
  return (
    <main className="relative flex h-full flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid-neon opacity-40" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />

      <div className="relative flex min-h-0 flex-1 flex-col items-center gap-2 px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <h1 className="font-display text-center text-sm font-black uppercase tracking-[0.28em] text-primary drop-shadow-[0_0_12px_var(--color-primary)]">
          Nimiq the Hexaman
        </h1>

        <HexamanGame />
      </div>
    </main>
  );
}

export default Index;
