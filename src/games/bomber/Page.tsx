import { lazy, Suspense } from "react";

const BomberGame = lazy(
  () => import("./components/BomberGame"),
);


function Index() {
  return (
    <main className="h-full min-h-0 overflow-hidden bg-arcade-bg bg-arcade-grid px-2 py-1 sm:px-3 sm:py-2">
      <div className="mx-auto flex h-full max-w-[500px] flex-col items-center gap-1">
        <header className="text-center">
          <h1 className="font-display text-sm text-arcade-highlight drop-shadow-[0_2px_0_var(--arcade-frame)] sm:text-xl">
            NIMIQ-BOMBER
          </h1>
        </header>

        <Suspense
          fallback={
            <p className="py-20 font-display text-sm text-arcade-muted">
              Loading arena...
            </p>
          }
        >
          <BomberGame />
        </Suspense>

        <section aria-label="Power-up legend" className="w-full text-arcade-muted">
          <ul className="grid grid-cols-6 gap-1 text-center text-[7px] sm:text-[9px]">
            {[
              ["#ff7a45", "Fire"],
              ["#f4f4f5", "Bomb"],
              ["#7ee787", "Boots"],
              ["#ffd166", "Glove"],
              ["#8ce0ff", "Remote"],
              ["#4fd1c5", "Vest"],
            ].map(([color, name]) => (
              <li key={name} className="flex min-w-0 items-center justify-center gap-1">
                <span
                  aria-hidden
                  className="inline-block h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                <strong className="truncate text-arcade-highlight">{name}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

export default Index;
