import type { Piece as PieceModel } from "@/games/checkers/lib/engine";

export type NeonColor = "yellow" | "blue" | "green" | "pink" | "orange" | "purple";

export const NEON_COLORS: Record<
  NeonColor,
  { label: string; fill: string; bright: string; stroke: string }
> = {
  yellow: {
    label: "Yellow",
    fill: "var(--color-neon-yellow-deep)",
    bright: "var(--color-neon-yellow-bright)",
    stroke: "var(--color-neon-yellow)",
  },
  blue: {
    label: "Blue",
    fill: "var(--color-neon-blue-deep)",
    bright: "var(--color-neon-blue-bright)",
    stroke: "var(--color-neon-blue)",
  },
  green: {
    label: "Green",
    fill: "var(--color-neon-green-deep)",
    bright: "var(--color-neon-green-bright)",
    stroke: "var(--color-neon-green)",
  },
  pink: {
    label: "Pink",
    fill: "var(--color-neon-pink-deep)",
    bright: "var(--color-neon-pink-bright)",
    stroke: "var(--color-neon-pink)",
  },
  orange: {
    label: "Orange",
    fill: "var(--color-neon-orange-deep)",
    bright: "var(--color-neon-orange-bright)",
    stroke: "var(--color-neon-orange)",
  },
  purple: {
    label: "Purple",
    fill: "var(--color-neon-purple-deep)",
    bright: "var(--color-neon-purple-bright)",
    stroke: "var(--color-neon-purple)",
  },
};

export const OPPONENT_COLORS: Record<NeonColor, NeonColor> = {
  yellow: "blue",
  blue: "yellow",
  green: "pink",
  pink: "green",
  orange: "purple",
  purple: "orange",
};

// Flat-topped hexagons with points on the left and right.
const HEX = "3,50 27,7 73,7 97,50 73,93 27,93";
const HEX_INNER = "20,50 36,22 64,22 80,50 64,78 36,78";
const HEX_GLEAM = "27,7 73,7 88,31 12,31";

export function HexPiece({
  piece,
  color,
  selected,
  interactive,
}: {
  piece: PieceModel;
  color: NeonColor;
  selected?: boolean;
  interactive?: boolean;
}) {
  const { fill, bright, stroke } = NEON_COLORS[color];
  const gid = `hexgrad-${color}${piece.king ? "-k" : ""}`;

  return (
    <svg
      viewBox="0 0 100 100"
      className={[
        "h-[78%] w-[78%] transition-transform duration-150",
        interactive ? "group-hover:scale-105" : "",
        selected ? "scale-110" : "",
      ].join(" ")}
      style={{ filter: `drop-shadow(0 0 ${selected ? 14 : 7}px ${stroke})` }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bright} stopOpacity="0.55" />
          <stop offset="45%" stopColor={fill} stopOpacity="1" />
          <stop offset="100%" stopColor={fill} stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <polygon
        points={HEX}
        fill={`url(#${gid})`}
        stroke={stroke}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* Highlight along the upper edge. */}
      <polygon points={HEX_GLEAM} fill={bright} opacity="0.28" />
      <polygon
        points={HEX_INNER}
        fill="none"
        stroke={stroke}
        strokeWidth={piece.king ? 5 : 2.5}
        strokeLinejoin="round"
        opacity={piece.king ? 0.95 : 0.4}
      />
      {piece.king && (
        <path
          d="M35 58 L35 44 L43 51 L50 40 L57 51 L65 44 L65 58 Z"
          fill={stroke}
          opacity={0.95}
        />
      )}
    </svg>
  );
}
