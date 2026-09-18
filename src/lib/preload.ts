/**
 * Full up-front download of every asset and game bundle.
 *
 * Without this, each game's code and images only start downloading when the
 * player opens that game. Here we fetch everything once, while the boot screen
 * is visible, so gameplay never waits on the network afterwards.
 */
import { GAMES } from "@/lib/games";

/** Static image files served from /public that games load at runtime. */
const PUBLIC_IMAGES = [
  "/games/shooter/ship.png",
  "/games/shooter/enemy-blue.png",
  "/games/shooter/enemy-green.png",
  "/games/shooter/enemy-purple.png",
  "/games/shooter/enemy-red.png",
  "/games/shooter/enemy-ufo.png",
  "/games/shooter/enemy-yellow.png",
  "/games/shooter/boss-fortress.png",
  "/games/shooter/boss-hive.png",
  "/favicon.ico",
];

/** Other static files fetched by games (the embedded shooter page). */
const PUBLIC_FILES = ["/games/shooter/index.html"];

function loadImage(src: string) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

function loadFile(src: string) {
  return fetch(src, { cache: "force-cache" })
    .then((res) => res.blob())
    .then(() => undefined)
    .catch(() => undefined);
}

/** Every module that makes up the games, so no game chunk loads on demand. */
const gameModules = import.meta.glob("/src/games/**/*.{ts,tsx}");
const componentModules = import.meta.glob("/src/components/**/*.tsx");

export type PreloadTask = () => Promise<unknown>;

export function buildPreloadTasks(): PreloadTask[] {
  const covers = GAMES.map((game) => game.cover);
  const images = [...new Set([...covers, ...PUBLIC_IMAGES])];

  return [
    ...images.map((src) => () => loadImage(src)),
    ...PUBLIC_FILES.map((src) => () => loadFile(src)),
    ...Object.values(gameModules).map((load) => () => load().catch(() => undefined)),
    ...Object.values(componentModules).map((load) => () => load().catch(() => undefined)),
  ];
}

/** Runs every task with limited concurrency, reporting progress 0..1. */
export async function runPreload(
  tasks: PreloadTask[],
  onProgress: (done: number, total: number) => void,
  concurrency = 6,
) {
  const total = tasks.length;
  let done = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < total) {
      const task = tasks[cursor++];
      try {
        await task?.();
      } catch {
        /* a single asset failing must not block the boot screen */
      }
      done += 1;
      onProgress(done, total);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, total) }, () => worker()),
  );
}
