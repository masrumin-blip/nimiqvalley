import bomberCover from "@/assets/game-covers/bomber.jpg";
import carromCover from "@/assets/game-covers/carrom.jpg";
import checkersCover from "@/assets/game-covers/checkers.jpg";
import crossingCover from "@/assets/game-covers/crossing.jpg";
import hexamanCover from "@/assets/game-covers/hexaman.jpg";
import jumpCover from "@/assets/game-covers/jump.jpg";
import mininjaCover from "@/assets/game-covers/mininja.jpg";
import petCover from "@/assets/game-covers/pet.jpg";
import raceCover from "@/assets/game-covers/race.jpg";
import rooftopCover from "@/assets/game-covers/rooftop.jpg";
import shipCover from "@/assets/game-covers/ship.jpg";
import shooterCover from "@/assets/game-covers/shooter.jpg";
import slideCover from "@/assets/game-covers/slide.jpg";
import soccerCover from "@/assets/game-covers/soccer.jpg";
import tappyCover from "@/assets/game-covers/tappy.jpg";

export type GameEntry = {
  slug: string;
  path: string;
  name: string;
  tagline: string;
  emoji: string;
  accent: string;
  cover: string;
  category: "arcade" | "multiplayer" | "just-for-fun";
};

export const GAMES: GameEntry[] = [
  {
    slug: "jump",
    path: "/games/jump",
    name: "Jump for Nimiq",
    tagline: "Climb a neon city while avoiding lasers and mines.",
    emoji: "🕹️",
    accent: "oklch(0.82 0.18 195)",
    cover: jumpCover,
    category: "arcade",
  },
  {
    slug: "race",
    path: "/games/race",
    name: "Nimiq Car Race",
    tagline: "Race solo in 3D against competitive bots on a low-poly track.",
    emoji: "🏎️",
    accent: "oklch(0.75 0.19 30)",
    cover: raceCover,
    category: "arcade",
  },
  {
    slug: "hexaman",
    path: "/games/hexaman",
    name: "Nimiq the Hexaman",
    tagline: "Explore an endless arcade maze, chase pellets, and avoid viruses.",
    emoji: "👾",
    accent: "oklch(0.85 0.19 95)",
    cover: hexamanCover,
    category: "multiplayer",
  },
  {
    slug: "mininja",
    path: "/games/mininja",
    name: "Nimiq Mininja",
    tagline: "Cyberpunk endless runner: jump, slash, and survive.",
    emoji: "🥷",
    accent: "oklch(0.72 0.24 348)",
    cover: mininjaCover,
    category: "arcade",
  },
  {
    slug: "pet",
    path: "/games/pet",
    name: "Nimiq Pet",
    tagline: "Care for your pet: feed, bathe, sleep, and play.",
    emoji: "🐣",
    accent: "oklch(0.72 0.15 162)",
    cover: petCover,
    category: "just-for-fun",
  },
  {
    slug: "rooftop",
    path: "/games/rooftop",
    name: "Nimiq Rooftop",
    tagline: "Run across 3D rooftops, leap over gaps, and collect coins.",
    emoji: "🏙️",
    accent: "oklch(0.78 0.16 60)",
    cover: rooftopCover,
    category: "arcade",
  },
  {
    slug: "slide",
    path: "/games/slide",
    name: "Nimiq Slide",
    tagline: "A light and stylish endless snowboarding ride.",
    emoji: "🏂",
    accent: "oklch(0.8 0.1 240)",
    cover: slideCover,
    category: "arcade",
  },
  {
    slug: "soccer",
    path: "/games/soccer",
    name: "Nimiq Soccer",
    tagline: "Neon table soccer against the CPU.",
    emoji: "⚽",
    accent: "oklch(0.82 0.19 150)",
    cover: soccerCover,
    category: "multiplayer",
  },
  {
    slug: "tappy",
    path: "/games/tappy",
    name: "Nimiq Tappy",
    tagline: "Fly through neon obstacles and climb the global leaderboard.",
    emoji: "🪙",
    accent: "oklch(0.85 0.18 150)",
    cover: tappyCover,
    category: "arcade",
  },
  {
    slug: "shooter",
    path: "/games/shooter",
    name: "CosNimiq Shooter",
    tagline: "Blast an alien fleet and defeat the bosses.",
    emoji: "🚀",
    accent: "oklch(0.75 0.2 300)",
    cover: shooterCover,
    category: "arcade",
  },
  {
    slug: "carrom",
    path: "/games/carrom",
    name: "Carronimiq",
    tagline: "Neon carrom: pull, aim, and release through five levels.",
    emoji: "🎯",
    accent: "oklch(0.85 0.16 205)",
    cover: carromCover,
    category: "multiplayer",
  },
  {
    slug: "checkers",
    path: "/games/checkers",
    name: "Nimiq Checkers",
    tagline: "International 10x10 draughts against the CPU at three difficulty levels.",
    emoji: "🔷",
    accent: "oklch(0.89 0.18 100)",
    cover: checkersCover,
    category: "multiplayer",
  },
  {
    slug: "bomber",
    path: "/games/bomber",
    name: "Nimiq Bomber",
    tagline: "Plant bombs, break blocks, and defeat enemies in a retro arena.",
    emoji: "💣",
    accent: "oklch(0.78 0.19 45)",
    cover: bomberCover,
    category: "multiplayer",
  },
  {
    slug: "ship",
    path: "/games/ship",
    name: "Nimiq Spaceship",
    tagline: "Survive enemy waves in a neon twin-stick arena.",
    emoji: "🛸",
    accent: "oklch(0.7 0.29 340)",
    cover: shipCover,
    category: "arcade",
  },
  {
    slug: "crossing",
    path: "/games/crossing",
    name: "Crossing for Nimiq",
    tagline: "Cross forest trails and rivers, dodge snakes, and collect coins.",
    emoji: "🐃",
    accent: "oklch(0.83 0.16 87)",
    cover: crossingCover,
    category: "arcade",
  },
];
