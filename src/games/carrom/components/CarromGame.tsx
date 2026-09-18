import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MatchResultDialog, type ResultRow } from "@/components/MatchResultDialog";
import { OnlinePanel } from "@/games/_shared/online/OnlinePanel";
import { useOnlineRoom } from "@/games/_shared/online/useOnlineRoom";
import { serverNow } from "@/lib/mp/clock";
import { TURN_TIMEOUT_MS } from "@/lib/mp/types";
import { playSfx } from "@/lib/sfx";
import {
  BOARD_B,
  BOARD_R,
  BOARD_SIZE,
  BOARD_X,
  BOARD_Y,
  CPU_STRIKER_LINE_Y,
  CX,
  CY,
  GAME_H,
  GAME_W,
  MAX_POWER,
  PIECE_R,
  POCKETS,
  POCKET_R,
  STRIKER_LINE_Y,
  STRIKER_MAX_X,
  STRIKER_MIN_X,
  STRIKER_R,
  createPieces,
  stepPhysics,
  type Piece,
} from "@/games/carrom/game/carrom";

type Phase = "menu" | "rules" | "guide" | "aim" | "moving" | "board" | "won" | "lost" | "online";
type Mode = "training" | "cpu" | "online";
type Difficulty = "easy" | "normal" | "hard";
type Side = "you" | "cpu";
type PlayerColor = "white" | "orange";
type DragMode = "position" | "aim";

const AIM_ACTIVATION_DISTANCE = 72;
const MIN_SHOT_PULL = 80;
// shots must keep a real forward component: nothing may travel along or behind
// the shooting line, so pieces behind it can only be reached by bank shots
const MIN_FORWARD_RATIO = 0.26;

// Official carrom match values
const MATCH_TARGET = 25; // points to win the match
const MATCH_BOARDS = 8; // boards won to win the match
const QUEEN_POINTS = 3;
const QUEEN_POINT_CAP = 22; // queen points only count below this score

const DIFFICULTY: Record<Difficulty, { label: string; jitter: number; power: number; blunder: number }> = {
  easy: { label: "Easy", jitter: 0.1, power: 0.6, blunder: 0.35 },
  normal: { label: "Normal", jitter: 0.045, power: 0.75, blunder: 0.12 },
  hard: { label: "Hard", jitter: 0.012, power: 0.88, blunder: 0 },
};

const COLORS: Record<string, { fill: string; glow: string }> = {
  white: { fill: "#fff86b", glow: "#f5ff32" },
  orange: { fill: "#77ff9b", glow: "#26ff72" },
  queen: { fill: "#ff8ad4", glow: "#ff2e9a" },
  striker: { fill: "#eafff2", glow: "#8affc1" },
  block: { fill: "#3a2b5c", glow: "#a06bff" },
};

interface Spark {
  x: number;
  y: number;
  life: number;
  color: string;
}

const colorLabel = (c: PlayerColor | null) =>
  c === "white" ? "Yellow" : c === "orange" ? "Green" : "not claimed yet";
const other = (c: PlayerColor): PlayerColor => (c === "white" ? "orange" : "white");
const sideName = (s: Side) => (s === "you" ? "You" : "CPU");

// ---------- CPU planning ----------
function segmentBlocked(
  pieces: Piece[],
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
  ignore: Piece[],
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return false;
  const ux = dx / len;
  const uy = dy / len;
  for (const p of pieces) {
    if (!p.alive || ignore.includes(p)) continue;
    const relX = p.x - from.x;
    const relY = p.y - from.y;
    const t = relX * ux + relY * uy;
    if (t <= 0 || t >= len) continue;
    const perp = Math.abs(relX * uy - relY * ux);
    if (perp < p.r + radius - 2) return true;
  }
  return false;
}

function planCpuShot(
  pieces: Piece[],
  color: PlayerColor | null,
  difficulty: Difficulty,
  mustCover: boolean,
  baselineY: number,
) {
  const striker = pieces.find((p) => p.kind === "striker");
  if (!striker) return null;
  const settings = DIFFICULTY[difficulty];
  const targets = pieces.filter((p) => {
    if (!p.alive) return false;
    if (p.kind === "queen") return !mustCover && color !== null;
    if (p.kind !== "white" && p.kind !== "orange") return false;
    return color === null || p.kind === color;
  });

  let best: { strikerX: number; dirX: number; dirY: number; score: number } | null = null;
  // shots may only go forward across the shooter's baseline, never behind it
  const forwardY = baselineY < CY ? 1 : -1;

  for (const target of targets) {
    for (const pocket of POCKETS) {
      const pdx = target.x - pocket.x;
      const pdy = target.y - pocket.y;
      const plen = Math.hypot(pdx, pdy);
      if (plen < 1) continue;
      const ghost = {
        x: target.x + (pdx / plen) * (PIECE_R + STRIKER_R),
        y: target.y + (pdy / plen) * (PIECE_R + STRIKER_R),
      };
      if (segmentBlocked(pieces, target, pocket, PIECE_R * 0.6, [target, striker])) continue;

      for (let i = 0; i <= 16; i++) {
        const strikerX = STRIKER_MIN_X + ((STRIKER_MAX_X - STRIKER_MIN_X) * i) / 16;
        const from = { x: strikerX, y: baselineY };
        const dx = ghost.x - from.x;
        const dy = ghost.y - from.y;
        const len = Math.hypot(dx, dy);
        if (dy * forwardY <= MIN_FORWARD_RATIO * len) continue;
        if (len < 40) continue;
        const ux = dx / len;
        const uy = dy / len;
        const cut = ux * (-pdx / plen) + uy * (-pdy / plen);
        if (cut < 0.3) continue;
        if (segmentBlocked(pieces, from, ghost, STRIKER_R * 0.8, [striker, target])) continue;
        const bonus = target.kind === "queen" ? 0.12 : 0;
        const score = cut * 2 + bonus - len / 4000 - plen / 5000;
        if (!best || score > best.score) best = { strikerX, dirX: ux, dirY: uy, score };
      }
    }
  }

  if (!best) {
    const strikerX = CX + (Math.random() - 0.5) * 180;
    const angle = (forwardY > 0 ? Math.PI / 2 : -Math.PI / 2) + (Math.random() - 0.5) * 0.9;
    best = { strikerX, dirX: Math.cos(angle), dirY: Math.sin(angle), score: 0 };
  }

  const blunder = Math.random() < settings.blunder;
  const jitter = (Math.random() - 0.5) * 2 * (blunder ? settings.jitter * 3 : settings.jitter);
  let angle = Math.atan2(best.dirY, best.dirX) + jitter;
  // never let jitter push the shot along or behind the baseline
  if (Math.sin(angle) * forwardY < MIN_FORWARD_RATIO) {
    const minForward = Math.asin(MIN_FORWARD_RATIO) * (forwardY > 0 ? 1 : -1);
    angle = Math.cos(angle) >= 0 ? minForward : Math.PI - minForward;
  }
  const power = MAX_POWER * settings.power * (0.9 + Math.random() * 0.2);

  return {
    strikerX: Math.min(Math.max(best.strikerX, STRIKER_MIN_X), STRIKER_MAX_X),
    vx: Math.cos(angle) * power,
    vy: Math.sin(angle) * power,
  };
}

export default function CarromGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const piecesRef = useRef<Piece[]>([]);
  const sparksRef = useRef<Spark[]>([]);
  const lastCollisionSfxRef = useRef(0);
  const dragRef = useRef<{ active: boolean; mode: DragMode; x: number; y: number } | null>(null);
  const phaseRef = useRef<Phase>("menu");
  const modeRef = useRef<Mode>("training");
  const difficultyRef = useRef<Difficulty>("normal");
  const turnRef = useRef<Side>("you");
  const shotPocketedRef = useRef<Piece[]>([]);
  const touchedRef = useRef(false);
  const exitOpenRef = useRef(false);

  // carrom rule state
  const youColorRef = useRef<PlayerColor | null>(null);
  const queenPendingRef = useRef<Side | null>(null);
  const queenOwnerRef = useRef<Side | null>(null);
  const dueRef = useRef<Record<Side, number>>({ you: 0, cpu: 0 });
  const matchRef = useRef({ you: 0, cpu: 0, youBoards: 0, cpuBoards: 0 });
  const breakerRef = useRef<Side>("you");

  const [phase, setPhase] = useState<Phase>("menu");
  const [mode, setMode] = useState<Mode>("training");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [turn, setTurn] = useState<Side>("you");
  const [shots, setShots] = useState(0);
  const [youColor, setYouColor] = useState<PlayerColor | null>(null);
  const [left, setLeft] = useState(9);
  const [cpuLeft, setCpuLeft] = useState(9);
  const [due, setDue] = useState<Record<Side, number>>({ you: 0, cpu: 0 });
  const [match, setMatch] = useState({ you: 0, cpu: 0, youBoards: 0, cpuBoards: 0 });
  const [queenTag, setQueenTag] = useState("on board");
  const [boardNo, setBoardNo] = useState(1);
  const [boardResult, setBoardResult] = useState<{ winner: Side; points: number; reason: string } | null>(null);
  const [scale, setScale] = useState(1);
  const [status, setStatus] = useState("");
  const [exitOpen, setExitOpen] = useState(false);
  const [round, setRound] = useState(0);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  useEffect(() => {
    const fit = () => {
      const w = window.innerWidth - 16;
      const h = window.innerHeight - 16;
      setScale(Math.min(w / GAME_W, h / GAME_H, 1));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const resetBoardState = useCallback((breaker: Side) => {
    piecesRef.current = createPieces();
    const openingStriker = piecesRef.current.find((piece) => piece.kind === "striker");
    if (openingStriker) openingStriker.y = breaker === "cpu" ? CPU_STRIKER_LINE_Y : STRIKER_LINE_Y;
    sparksRef.current = [];
    dragRef.current = null;
    shotPocketedRef.current = [];
    touchedRef.current = false;
    youColorRef.current = null;
    queenPendingRef.current = null;
    queenOwnerRef.current = null;
    dueRef.current = { you: 0, cpu: 0 };
    turnRef.current = breaker;
    setYouColor(null);
    setTurn(breaker);
    setDue({ you: 0, cpu: 0 });
    setLeft(9);
    setCpuLeft(9);
    setQueenTag("on board");
    setBoardResult(null);
    setRound((r) => r + 1);
  }, []);

  const startGame = useCallback(
    (m: Mode, d: Difficulty) => {
      modeRef.current = m;
      difficultyRef.current = d;
      setMode(m);
      setDifficulty(d);
      matchRef.current = { you: 0, cpu: 0, youBoards: 0, cpuBoards: 0 };
      setMatch({ you: 0, cpu: 0, youBoards: 0, cpuBoards: 0 });
      breakerRef.current = "you";
      setBoardNo(1);
      setShots(0);
      resetBoardState("you");
      setStatus(
        m === "training"
          ? "Training: full carrom rules, no opponent."
          : `Match to ${MATCH_TARGET} points — claim a colour with your first pocket.`,
      );
      setExitOpen(false);
      exitOpenRef.current = false;
      setPhaseBoth("guide");
    },
    [resetBoardState, setPhaseBoth],
  );

  const nextBoard = useCallback(() => {
    breakerRef.current = breakerRef.current === "you" ? "cpu" : "you";
    setBoardNo((n) => n + 1);
    resetBoardState(breakerRef.current);
    setStatus(
      breakerRef.current === "you" ? "New board — you break." : "New board — CPU breaks.",
    );
    setPhaseBoth("aim");
  }, [resetBoardState, setPhaseBoth]);

  // ---- online play ----
  const navigate = useNavigate();
  const online = useOnlineRoom({
    gameSlug: "carrom",
    active: phase === "online" || mode === "online",
    maxPlayers: 2,
    settings: { freeTurn: true },
  });
  const room = online.room;
  const rivalName = room?.players.find((p) => p.wallet !== online.wallet)?.name ?? "Rival";
  const onlineResultOpen = mode === "online" && (phase === "won" || phase === "lost");

  const striker = () => piecesRef.current.find((p) => p.kind === "striker");

  const sendShot = useCallback(
    (x: number, vx: number, vy: number) => {
      if (!room) return;
      online.sendMove(room.turnNo, "shot", { x, vx, vy });
    },
    [online, room],
  );

  // Start the board as soon as both players are seated.
  useEffect(() => {
    if (room?.status === "playing" && (phase === "online" || phase === "menu")) {
      startGame("online", difficulty);
      setPhaseBoth("aim");
    }
  }, [room?.status, phase, startGame, difficulty, setPhaseBoth]);

  // Replay the rival's shot, mirrored through the board centre.
  const appliedShots = useRef(0);
  useEffect(() => {
    if (mode !== "online") return;
    const fresh = online.moves.slice(appliedShots.current);
    if (fresh.length === 0) return;
    appliedShots.current = online.moves.length;
    for (const rec of fresh) {
      if (rec.wallet === online.wallet || rec.kind !== "shot") continue;
      const s = striker();
      if (!s) continue;
      s.x = Math.min(Math.max(2 * CX - Number(rec.payload["x"]), STRIKER_MIN_X), STRIKER_MAX_X);
      s.y = CPU_STRIKER_LINE_Y;
      s.vx = -Number(rec.payload["vx"]);
      s.vy = -Number(rec.payload["vy"]);
      s.alive = true;
      shotPocketedRef.current = [];
      touchedRef.current = false;
      turnRef.current = "cpu";
      setTurn("cpu");
      playSfx("flick", 0.7);
      setPhaseBoth("moving");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online.moves, mode]);

  useEffect(() => {
    appliedShots.current = 0;
  }, [room?.id]);

  // Ten seconds per shot: an automatic stroke keeps both boards in sync.
  useEffect(() => {
    if (mode !== "online" || phase !== "aim" || turn !== "you") return;
    // Anchored to the server turn clock so both boards time out together.
    const started = room?.turnStartedAt ? Date.parse(room.turnStartedAt) : serverNow();
    const remaining = Math.max(0, TURN_TIMEOUT_MS - (serverNow() - started));
    const timer = setTimeout(() => {
      if (phaseRef.current !== "aim" || turnRef.current !== "you") return;
      const s = striker();
      if (!s) return;
      const shot = planCpuShot(
        piecesRef.current,
        youColorRef.current,
        "easy",
        queenPendingRef.current === "you",
        STRIKER_LINE_Y,
      );
      if (!shot) return;
      s.x = shot.strikerX;
      s.y = STRIKER_LINE_Y;
      s.vx = shot.vx;
      s.vy = shot.vy;
      sendShot(s.x, s.vx, s.vy);
      shotPocketedRef.current = [];
      touchedRef.current = false;
      setShots((v) => v + 1);
      playSfx("flick", 0.8);
      setPhaseBoth("moving");
    }, remaining);
    return () => clearTimeout(timer);
  }, [mode, phase, turn, room?.turnStartedAt, setPhaseBoth, sendShot]);

  // Publish the winner once the match ends.
  const reportedRef = useRef(false);
  useEffect(() => {
    if (mode !== "online" || !room) return;
    if (phase !== "won" && phase !== "lost") {
      reportedRef.current = false;
      return;
    }
    if (reportedRef.current) return;
    reportedRef.current = true;
    const rival = room.players.find((p) => p.wallet !== online.wallet)?.wallet ?? null;
    online.finish(phase === "won" ? (online.wallet ?? null) : rival);
  }, [mode, phase, room, online]);

  const resultRows: ResultRow[] = (() => {
    const mine = {
      wallet: online.wallet ?? "you",
      name: "You",
      isYou: true,
      points: match.you,
      stats: [
        { label: "Points", value: String(match.you) },
        { label: "Boards", value: String(match.youBoards) },
        { label: "Shots", value: String(shots) },
        { label: "Pieces left", value: String(left) },
      ],
    };
    const rival = {
      wallet: "rival",
      name: rivalName,
      isYou: false,
      points: match.cpu,
      stats: [
        { label: "Points", value: String(match.cpu) },
        { label: "Boards", value: String(match.cpuBoards) },
        { label: "Pieces left", value: String(cpuLeft) },
      ],
    };
    return [mine, rival]
      .sort((a, b) => b.points - a.points)
      .map(({ wallet, name, isYou, stats }) => ({ wallet, name, isYou, stats }));
  })();


  // ---- input ----
  const toGame = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * GAME_W,
      y: ((e.clientY - rect.top) / rect.height) * GAME_H,
    };
  };

  const canControl = () => phaseRef.current === "aim" && (modeRef.current === "training" || turnRef.current === "you");

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canControl()) return;
    const point = toGame(e);
    const s = striker();
    if (!point || !s) return;
    const { x, y } = point;
    if (Math.hypot(x - s.x, y - s.y) < STRIKER_R * 3) {
      (e.target as Element).setPointerCapture(e.pointerId);
      dragRef.current = { active: true, mode: "position", x: s.x, y: STRIKER_LINE_Y };
    } else if (y > STRIKER_LINE_Y - 90) {
      s.x = Math.min(Math.max(x, STRIKER_MIN_X), STRIKER_MAX_X);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d?.active) return;
    const point = toGame(e);
    const s = striker();
    if (!point || !s) return;
    if (d.mode === "position") {
      if (Math.abs(point.y - STRIKER_LINE_Y) > AIM_ACTIVATION_DISTANCE) {
        d.mode = "aim";
        d.x = point.x;
        d.y = point.y;
      } else {
        s.x = Math.min(Math.max(point.x, STRIKER_MIN_X), STRIKER_MAX_X);
        d.x = s.x;
        d.y = STRIKER_LINE_Y;
      }
    } else {
      // aim is limited to forward of the shooting line — never along or behind it,
      // so pieces behind the line can only be reached with bank shots
      const minSlope = Math.tan(Math.asin(MIN_FORWARD_RATIO));
      d.x = point.x;
      d.y = Math.max(point.y, s.y + Math.abs(point.x - s.x) * minSlope);
    }
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || !canControl()) return;
    if (d.mode === "position") return;
    const s = striker();
    if (!s) return;
    const dx = s.x - d.x;
    const dy = s.y - d.y;
    const dist = Math.hypot(dx, dy);
    if (dist < MIN_SHOT_PULL) return;
    const power = Math.min(dist / 170, 1) * MAX_POWER * 0.9;
    s.vx = (dx / dist) * power;
    s.vy = (dy / dist) * power;
    if (modeRef.current === "online") sendShot(s.x, s.vx, s.vy);
    shotPocketedRef.current = [];
    touchedRef.current = false;
    setShots((v) => v + 1);
    playSfx("flick", 0.9);
    setPhaseBoth("moving");
  };

  // ---- CPU turn ----
  useEffect(() => {
    if (phase !== "aim" || mode !== "cpu" || turn !== "cpu") return;
    const timer = setTimeout(() => {
      if (phaseRef.current !== "aim" || turnRef.current !== "cpu" || exitOpenRef.current) return;
      const s = striker();
      if (!s) return;
      const cpuColor = youColorRef.current ? other(youColorRef.current) : null;
      const shot = planCpuShot(
        piecesRef.current,
        cpuColor,
        difficultyRef.current,
        queenPendingRef.current === "cpu",
        CPU_STRIKER_LINE_Y,
      );
      if (!shot) return;
      s.x = shot.strikerX;
      s.y = CPU_STRIKER_LINE_Y;
      s.vx = shot.vx;
      s.vy = shot.vy;
      shotPocketedRef.current = [];
      touchedRef.current = false;
      playSfx("flick", 0.7);
      setPhaseBoth("moving");
    }, 900);
    return () => clearTimeout(timer);
  }, [phase, mode, turn, setPhaseBoth]);

  // ---- loop ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();

    const spotPiece = (piece: Piece) => {
      const offsets: Array<readonly [number, number]> = [
        [0, 0], [38, 0], [-38, 0], [19, 33], [-19, 33], [19, -33], [-19, -33],
        [58, 20], [-58, 20], [58, -20], [-58, -20],
      ];
      const target = offsets.find(([ox, oy]) =>
        piecesRef.current.every((o) =>
          o === piece || !o.alive || Math.hypot(o.x - (CX + ox), o.y - (CY + oy)) > o.r + piece.r + 3,
        ),
      ) ?? [0, 0];
      piece.x = CX + (target[0] ?? 0);
      piece.y = CY + (target[1] ?? 0);
      piece.vx = 0;
      piece.vy = 0;
      piece.alive = true;
    };

    const colorOf = (side: Side): PlayerColor | null => {
      const c = youColorRef.current;
      if (!c) return null;
      return side === "you" ? c : other(c);
    };

    const returnQueen = () => {
      const queen = piecesRef.current.find((p) => p.kind === "queen");
      if (queen && !queen.alive) spotPiece(queen);
      queenPendingRef.current = null;
      setQueenTag("on board");
    };

    // return one previously pocketed piece of that side, or note a debt
    const applyPenalty = (side: Side) => {
      const c = colorOf(side);
      const dead = c
        ? [...piecesRef.current].reverse().find((p) => p.kind === c && !p.alive)
        : undefined;
      if (dead) spotPiece(dead);
      else {
        dueRef.current[side] += 1;
        setDue({ ...dueRef.current });
      }
    };

    const endBoard = (winner: Side, reason: string) => {
      const loser: Side = winner === "you" ? "cpu" : "you";
      const loserColor = colorOf(loser);
      const menLeft = loserColor
        ? piecesRef.current.filter((p) => p.alive && p.kind === loserColor).length
        : 0;
      let points = menLeft;
      if (queenOwnerRef.current === winner && matchRef.current[winner] < QUEEN_POINT_CAP) {
        points += QUEEN_POINTS;
      }
      matchRef.current[winner] += points;
      if (winner === "you") matchRef.current.youBoards += 1;
      else matchRef.current.cpuBoards += 1;
      setMatch({ ...matchRef.current });
      setBoardResult({ winner, points, reason });

      if (modeRef.current === "training") {
        playSfx(winner === "you" ? "win" : "gameover");
        setPhaseBoth(winner === "you" ? "won" : "lost");
        return;
      }
      const done =
        matchRef.current.you >= MATCH_TARGET ||
        matchRef.current.cpu >= MATCH_TARGET ||
        matchRef.current.youBoards >= MATCH_BOARDS ||
        matchRef.current.cpuBoards >= MATCH_BOARDS;
      if (done) {
        const youWon = matchRef.current.you > matchRef.current.cpu;
        playSfx(youWon ? "win" : "gameover");
        setPhaseBoth(youWon ? "won" : "lost");
      } else {
        setPhaseBoth("board");
      }
    };

    const resolveTurn = () => {
      const ps = piecesRef.current;
      const s = striker();
      if (!s) return;
      const vsCpu = modeRef.current !== "training";
      const shooter: Side = vsCpu ? turnRef.current : "you";
      const opponent: Side = shooter === "you" ? "cpu" : "you";
      const pocketed = shotPocketedRef.current;
      const strikerFoul = pocketed.some((p) => p.kind === "striker");
      const men = pocketed.filter((p) => p.kind === "white" || p.kind === "orange");
      const queenPocketed = pocketed.some((p) => p.kind === "queen");
      const noContact = !touchedRef.current;
      const foul = strikerFoul || noContact;

       // striker returns to the shooter's own baseline
      s.alive = true;
      s.x = Math.min(Math.max(s.x, STRIKER_MIN_X), STRIKER_MAX_X);
       s.y = shooter === "cpu" ? CPU_STRIKER_LINE_Y : STRIKER_LINE_Y;
      s.vx = 0;
      s.vy = 0;

      // first legal pocket claims the colour for the rest of the board
      if (!youColorRef.current && !foul && men.length > 0) {
        const whites = men.filter((p) => p.kind === "white").length;
        const claimed: PlayerColor = whites >= men.length - whites ? "white" : "orange";
        youColorRef.current = shooter === "you" ? claimed : other(claimed);
        setYouColor(youColorRef.current);
      }

      const myColor = colorOf(shooter);
      const ownMen = myColor ? men.filter((p) => p.kind === myColor) : [];
      let message = "";
      let continueTurn = false;

      if (foul) {
        // pieces pocketed on a foul stroke go back, plus one penalty piece
        men.forEach(spotPiece);
        if (queenPocketed) returnQueen();
        if (queenPendingRef.current === shooter) returnQueen();
        applyPenalty(shooter);
        message = strikerFoul
          ? `${sideName(shooter)} pocketed the striker — foul, one piece returned.`
          : `${sideName(shooter)} hit nothing — foul, one piece returned.`;
        playSfx("lose", 0.35);
      } else {
        // pay any outstanding debt with pieces pocketed now
        const kept = [...ownMen];
        while (dueRef.current[shooter] > 0 && kept.length > 0) {
          const p = kept.pop();
          if (p) spotPiece(p);
          dueRef.current[shooter] -= 1;
          setDue({ ...dueRef.current });
        }
        const covered = kept.length > 0;

        if (queenPendingRef.current === shooter) {
          if (covered) {
            queenOwnerRef.current = shooter;
            queenPendingRef.current = null;
            setQueenTag(`${sideName(shooter)} covered`);
            message = `${sideName(shooter)} covered the queen (+${QUEEN_POINTS} at board end).`;
          } else {
            returnQueen();
            message = "Queen not covered — returned to the centre.";
          }
        } else if (queenPocketed) {
          if (covered) {
            queenOwnerRef.current = shooter;
            queenPendingRef.current = null;
            setQueenTag(`${sideName(shooter)} covered`);
            message = `${sideName(shooter)} pocketed and covered the queen.`;
          } else {
            queenPendingRef.current = shooter;
            setQueenTag(`${sideName(shooter)} must cover`);
            message = `${sideName(shooter)} must now pocket an own piece to keep the queen.`;
          }
        }

        const oppMen = myColor ? men.filter((p) => p.kind !== myColor) : [];
        if (oppMen.length > 0 && !message) {
          message = `${sideName(shooter)} pocketed ${oppMen.length} opponent piece(s) — turn passes.`;
        }
        if (covered && !message) message = "Valid pocket — shoot again.";

        continueTurn = covered || queenPendingRef.current === shooter;
      }

      const youColorNow = colorOf("you");
      const cpuColorNow = colorOf("cpu");
      const youRemaining = youColorNow ? ps.filter((p) => p.alive && p.kind === youColorNow).length : 9;
      const cpuRemaining = cpuColorNow ? ps.filter((p) => p.alive && p.kind === cpuColorNow).length : 9;
      setLeft(youRemaining);
      setCpuLeft(cpuRemaining);

      if (myColor) {
        const shooterLeft = shooter === "you" ? youRemaining : cpuRemaining;
        const opponentLeft = shooter === "you" ? cpuRemaining : youRemaining;
        const queenSettled = queenOwnerRef.current !== null;
        if (shooterLeft === 0 && dueRef.current[shooter] === 0) {
          if (!queenSettled) {
            endBoard(opponent, `${sideName(shooter)} cleared their pieces with the queen still open.`);
          } else {
            endBoard(shooter, `${sideName(shooter)} pocketed all of their pieces.`);
          }
          return;
        }
        if (opponentLeft === 0 && dueRef.current[opponent] === 0) {
          if (!queenSettled) {
            endBoard(shooter, `${sideName(opponent)} lost their last piece with the queen still open.`);
          } else {
            endBoard(opponent, `${sideName(opponent)}'s pieces are all pocketed.`);
          }
          return;
        }
      }

      if (!vsCpu) {
        setStatus(message || "Training — keep shooting.");
        setPhaseBoth("aim");
        return;
      }

      if (continueTurn) {
        setStatus(message || `${sideName(shooter)} shoots again.`);
        setPhaseBoth("aim");
        return;
      }

      const next: Side = opponent;
       s.y = next === "cpu" ? CPU_STRIKER_LINE_Y : STRIKER_LINE_Y;
      turnRef.current = next;
      setTurn(next);
      setStatus(`${message} ${next === "you" ? "Your turn." : "CPU is thinking…"}`.trim());
      setPhaseBoth("aim");
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // Online runs a fixed timestep so both clients replay identical physics.
      const dt =
        modeRef.current === "online" ? 1 / 60 : Math.min((now - last) / 1000, 0.033);
      last = now;

      if (phaseRef.current === "moving" && !exitOpenRef.current) {
        let moving = false;
        for (let i = 0; i < 3; i++) {
          const res = stepPhysics(piecesRef.current, dt / 3);
          moving = res.moving;
          if (res.hits.length > 0) touchedRef.current = true;
          for (const h of res.hits)
            sparksRef.current.push({ x: h.x, y: h.y, life: 1, color: "#8affc1" });
          if (res.hits.length > 0) {
            const nowMs = performance.now();
            if (nowMs - lastCollisionSfxRef.current > 45) {
              lastCollisionSfxRef.current = nowMs;
              /* loudest hit of this step decides the sound: wooden clack for
                 piece-on-piece, softer rail thump for a cushion bounce */
              const strongest = res.hits.reduce((m, h) => (h.speed > m.speed ? h : m), res.hits[0]!);
              const vol = Math.max(0.25, Math.min(1, strongest.speed / 620));
              playSfx(strongest.wall ? "rail" : "clack", vol);
            }
          }
          for (const p of res.pocketed) {
            const color = COLORS[p.kind];
            if (color) sparksRef.current.push({ x: p.x, y: p.y, life: 1.4, color: color.glow });
            shotPocketedRef.current.push(p);
            playSfx("pocket", p.kind === "striker" ? 0.55 : 0.75);
            if (p.kind === "queen") playSfx("score", 0.6);
          }
        }
        if (!moving) resolveTurn();
      }

      sparksRef.current = sparksRef.current.filter((s) => (s.life -= dt * 2.2) > 0);
      draw(
        ctx,
        piecesRef.current,
        sparksRef.current,
        dragRef.current,
        phaseRef.current,
        modeRef.current === "cpu" ? turnRef.current : "you",
      );
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [round, setPhaseBoth]);

  const openExit = () => {
    exitOpenRef.current = true;
    setExitOpen(true);
  };

  const closeExit = () => {
    exitOpenRef.current = false;
    setExitOpen(false);
  };

  const confirmExit = () => {
    closeExit();
    setPhaseBoth("menu");
  };

  const modeTitle =
    mode === "training"
      ? "Training"
      : mode === "online"
        ? `Online · vs ${rivalName} · Board ${boardNo}`
        : `VS CPU · ${DIFFICULTY[difficulty].label} · Board ${boardNo}`;

  return (
    <div
      ref={wrapRef}
      className="relative"
      style={{
        width: GAME_W * scale,
        height: GAME_H * scale,
      }}
    >
      <div
        style={{
          width: GAME_W,
          height: GAME_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        className="relative"
      >
        <canvas
          ref={canvasRef}
          width={GAME_W}
          height={GAME_H}
          className="touch-none rounded-3xl"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        {/* HUD */}
        {(phase === "aim" || phase === "moving") && (
          <div className="pointer-events-none absolute inset-x-0 top-0 p-6">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
              <div className="min-w-0">
                <p className="truncate text-3xl font-black tracking-tight text-neon-cyan drop-shadow-[0_0_18px_var(--neon-cyan)]">
                  {modeTitle}
                </p>
                <p className="truncate text-base text-muted-foreground">{status}</p>
              </div>
              <div className="pointer-events-auto flex shrink-0 gap-2">
                <button
                  onClick={() => startGame(mode, difficulty)}
                  className="rounded-full border border-neon-cyan/50 px-4 py-2 text-sm font-semibold text-neon-cyan"
                >
                  Restart
                </button>
                <button
                  onClick={openExit}
                  className="rounded-full border border-neon-pink/50 px-4 py-2 text-sm font-semibold text-neon-pink"
                >
                  Exit
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-lg font-bold">
              {mode === "cpu" ? (
                <>
                  <span className="rounded-xl bg-card/60 px-4 py-2 text-neon-lime">
                    {turn === "you" ? "Your turn" : "CPU turn"}
                  </span>
                  <span className="rounded-xl bg-card/60 px-4 py-2 text-neon-amber">
                    You {left} left · {match.you} pts
                  </span>
                  <span className="rounded-xl bg-card/60 px-4 py-2 text-neon-cyan">
                    CPU {cpuLeft} left · {match.cpu} pts
                  </span>
                </>
              ) : (
                <>
                  <span className="rounded-xl bg-card/60 px-4 py-2 text-neon-lime">Shots {shots}</span>
                  <span className="rounded-xl bg-card/60 px-4 py-2 text-neon-amber">
                    Yours {left} · Other {cpuLeft}
                  </span>
                </>
              )}
              <span className="rounded-xl bg-card/60 px-4 py-2 text-neon-pink">Queen: {queenTag}</span>
              <span className="rounded-xl bg-card/60 px-4 py-2 text-foreground">
                Your colour: {colorLabel(youColor)}
              </span>
              {(due.you > 0 || due.cpu > 0) && (
                <span className="rounded-xl bg-card/60 px-4 py-2 text-neon-pink">
                  Debt You {due.you} · CPU {due.cpu}
                </span>
              )}
            </div>
          </div>
        )}

        {phase === "menu" && (
          <Overlay>
            <h1 className="text-6xl font-black tracking-tighter text-neon-yellow drop-shadow-[0_0_30px_var(--neon-yellow)]">
              CARRONIMIQ
            </h1>
            <p className="mt-3 max-w-md text-center text-muted-foreground">
              Official carrom rules: claim your colour with the first pocket, cover the
              queen, and play boards up to {MATCH_TARGET} points.
            </p>
            <div className="mt-8 grid w-full max-w-md gap-3">
              <button
                onClick={() => startGame("training", difficulty)}
                className="rounded-2xl border border-neon-cyan/50 bg-card/70 px-5 py-4 text-left transition hover:border-neon-cyan hover:bg-card"
              >
                <span className="block text-xl font-bold text-foreground">Training</span>
                <span className="block text-sm text-muted-foreground">
                  Free practice with the same rules, no opponent.
                </span>
              </button>
              <div className="rounded-2xl border border-neon-pink/40 bg-card/60 px-5 py-4">
                <span className="block text-xl font-bold text-foreground">VS CPU</span>
                <span className="block text-sm text-muted-foreground">
                  Full match: boards, queen, fouls and penalties. Pick a difficulty.
                </span>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => startGame("cpu", d)}
                      className="rounded-xl border border-neon-lime/50 px-3 py-3 text-base font-bold text-neon-lime transition hover:bg-neon-lime hover:text-background"
                    >
                      {DIFFICULTY[d].label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setPhaseBoth("online")}
                className="rounded-2xl border border-neon-lime/50 bg-card/70 px-5 py-4 text-left transition hover:border-neon-lime hover:bg-card"
              >
                <span className="block text-xl font-bold text-foreground">Online</span>
                <span className="block text-sm text-muted-foreground">
                  Play a real rival: create a room, join a code, or challenge a friend.
                </span>
              </button>
              <button
                onClick={() => setPhaseBoth("rules")}
                className="flex items-center justify-center gap-2 rounded-2xl border border-neon-amber/50 bg-card/60 px-5 py-4 transition hover:border-neon-amber hover:bg-card"
              >
                <span className="flex size-7 items-center justify-center rounded-full border border-neon-amber text-lg font-black text-neon-amber">
                  i
                </span>
                <span className="text-lg font-bold text-foreground">Game Rules</span>
              </button>
            </div>
          </Overlay>
        )}

        {phase === "online" && (
          <Overlay>
            <h2 className="text-4xl font-black text-neon-lime">ONLINE MATCH</h2>
            <p className="mt-2 max-w-sm text-center text-muted-foreground">
              Take turns with a real rival. Ten seconds per shot.
            </p>
            <div className="mt-6 w-full max-w-sm">
              <OnlinePanel
                online={online}
                maxPlayers={2}
                onBack={() => setPhaseBoth("menu")}
              />
            </div>
          </Overlay>
        )}

        <MatchResultDialog
          open={onlineResultOpen}
          title={phase === "won" ? "You win!" : `${rivalName} wins`}
          subtitle="Final standings"
          rows={resultRows}
          onPlayAgain={() => {
            online.leave.mutate();
            setPhaseBoth("menu");
          }}
          onExit={() => navigate({ to: "/games" })}
        />


        {phase === "rules" && (
          <Overlay>
            <p className="text-sm font-bold uppercase text-neon-cyan">Carrom rules</p>
            <h2 className="mt-2 text-center text-4xl font-black text-foreground">How to play</h2>
            <div className="mt-8 grid w-full max-w-lg gap-5 text-left">
              <GuideStep number="1" title="Striker" text="Drag sideways on the baseline, pull down to aim and set power, release to shoot." />
              <GuideStep number="2" title="Aim forward" text="Pull down to aim — shots always go forward across your shooting line, never along or behind it. Pieces behind the line can only be reached with bank shots off the walls." />
              <GuideStep number="3" title="Your colour" text="The first piece legally pocketed decides your colour for that board." />
              <GuideStep number="4" title="Keep shooting" text="Pocket one of your own pieces and you shoot again." />
              <GuideStep number="5" title="Queen" text="Pocket the queen, then cover it with your own piece in the same or next stroke, or it returns to the centre. Covered queen = 3 points." />
              <GuideStep number="6" title="Fouls" text="Pocketing the striker, or hitting nothing, returns one of your pieces to the centre and ends your turn. With no piece pocketed yet, the penalty is owed." />
              <GuideStep number="7" title="Winning" text={`Clear your pieces (queen already settled) to win the board: 1 point per opponent piece left, plus 3 for a covered queen. Match to ${MATCH_TARGET} points or ${MATCH_BOARDS} boards.`} />
            </div>
            <button
              onClick={() => setPhaseBoth("menu")}
              className="mt-9 rounded-full border border-neon-cyan/60 bg-card/70 px-8 py-3 text-lg font-black text-neon-cyan"
            >
              Back to Menu
            </button>
          </Overlay>
        )}

        {phase === "guide" && (
          <Overlay>
            <p className="text-sm font-bold uppercase text-neon-cyan">Carrom rules</p>
            <h2 className="mt-2 text-center text-4xl font-black text-foreground">Claim. Cover. Clear.</h2>
            <div className="mt-8 grid w-full max-w-lg gap-5 text-left">
              <GuideStep number="1" title="Striker" text="Drag sideways on the baseline, pull down to aim and set power, release to shoot." />
              <GuideStep number="2" title="Aim forward" text="Pull down to aim — shots always go forward across your shooting line, never along or behind it. Pieces behind the line can only be reached with bank shots off the walls." />
              <GuideStep number="3" title="Your colour" text="The first piece legally pocketed decides your colour for that board." />
              <GuideStep number="4" title="Keep shooting" text="Pocket one of your own pieces and you shoot again." />
              <GuideStep number="5" title="Queen" text="Pocket the queen, then cover it with your own piece in the same or next stroke, or it returns to the centre. Covered queen = 3 points." />
              <GuideStep number="6" title="Fouls" text="Pocketing the striker, or hitting nothing, returns one of your pieces to the centre and ends your turn. With no piece pocketed yet, the penalty is owed." />
              <GuideStep number="7" title="Winning" text={`Clear your pieces (queen already settled) to win the board: 1 point per opponent piece left, plus 3 for a covered queen. Match to ${MATCH_TARGET} points or ${MATCH_BOARDS} boards.`} />
            </div>
            <button
              onClick={() => setPhaseBoth("aim")}
              className="mt-9 rounded-full bg-neon-lime px-8 py-3 text-lg font-black text-background"
            >
              {mode === "training" ? "Start Training" : "Start Match"}
            </button>
          </Overlay>
        )}

        {phase === "board" && boardResult && (
          <Overlay>
            <h2 className="text-4xl font-black text-neon-cyan">
              {boardResult.winner === "you" ? "You win the board" : "CPU wins the board"}
            </h2>
            <p className="mt-3 max-w-md text-center text-muted-foreground">{boardResult.reason}</p>
            <p className="mt-4 text-2xl font-bold text-foreground">
              +{boardResult.points} points
            </p>
            <p className="mt-2 text-lg text-muted-foreground">
              Match: You {match.you} ({match.youBoards} boards) · CPU {match.cpu} ({match.cpuBoards} boards)
            </p>
            <button
              onClick={nextBoard}
              className="mt-8 rounded-full bg-neon-lime px-8 py-3 text-lg font-black text-background"
            >
              Next Board
            </button>
          </Overlay>
        )}

        {(phase === "won" || phase === "lost") && (
          <Overlay>
            <h2
              className={`text-5xl font-black ${
                phase === "won" ? "text-neon-lime" : "text-neon-pink"
              }`}
            >
              {mode === "training" ? "BOARD CLEARED" : phase === "won" ? "YOU WIN" : "CPU WINS"}
            </h2>
            <p className="mt-2 text-center text-muted-foreground">
              {mode === "cpu"
                ? `You ${match.you} pts (${match.youBoards} boards) · CPU ${match.cpu} pts (${match.cpuBoards} boards)`
                : `${shots} shots · ${boardResult?.reason ?? ""}`}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => startGame(mode, difficulty)}
                className="rounded-full border border-neon-cyan/60 bg-card/70 px-6 py-3 font-semibold text-neon-cyan"
              >
                Play Again
              </button>
              <button
                onClick={() => setPhaseBoth("menu")}
                className="rounded-full border border-border px-6 py-3 font-semibold text-foreground"
              >
                Main Menu
              </button>
            </div>
          </Overlay>
        )}

        {exitOpen && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/85 px-8 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-neon-pink/50 bg-card p-8 text-center shadow-2xl">
              <h2 className="text-3xl font-black text-foreground">Exit this game?</h2>
              <p className="mt-3 text-muted-foreground">Your current progress will be lost.</p>
              <div className="mt-7 flex justify-center gap-3">
                <button
                  onClick={closeExit}
                  className="min-w-28 rounded-full border border-neon-cyan/60 px-6 py-3 font-bold text-neon-cyan"
                >
                  No
                </button>
                <button
                  onClick={confirmExit}
                  className="min-w-28 rounded-full bg-neon-pink px-6 py-3 font-bold text-background"
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto bg-background/85 px-8 py-10 backdrop-blur-sm">
      {children}
    </div>
  );
}

function GuideStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="flex items-start gap-5">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-neon-pink/60 text-xl font-black text-neon-pink">
        {number}
      </span>
      <span>
        <strong className="block text-xl text-foreground">{title}</strong>
        <span className="mt-1 block text-base text-muted-foreground">{text}</span>
      </span>
    </div>
  );
}

// ---------- rendering ----------
function draw(
  ctx: CanvasRenderingContext2D,
  pieces: Piece[],
  sparks: Spark[],
  drag: { active: boolean; x: number; y: number } | null,
  phase: Phase,
  activeSide: Side,
) {
  ctx.clearRect(0, 0, GAME_W, GAME_H);
  const bg = ctx.createLinearGradient(0, 0, GAME_W, GAME_H);
  bg.addColorStop(0, "#07060f");
  bg.addColorStop(1, "#120a24");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  // board
  ctx.save();
  ctx.shadowColor = "#39e6ff";
  ctx.shadowBlur = 32;
  ctx.strokeStyle = "#39e6ff";
  ctx.lineWidth = 4;
  roundRect(ctx, BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE, 28);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "rgba(18,10,40,0.75)";
  roundRect(ctx, BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE, 28);
  ctx.fill();

  // inner decoration
  const cx = BOARD_X + BOARD_SIZE / 2;
  const cy = BOARD_Y + BOARD_SIZE / 2;
  ctx.save();
  ctx.strokeStyle = "rgba(160,107,255,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 120, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([10, 14]);
  ctx.strokeRect(BOARD_X + 60, BOARD_Y + 60, BOARD_SIZE - 120, BOARD_SIZE - 120);
  ctx.restore();

  // Opponents shoot from opposite baselines, as on a real carrom board.
  for (const side of ["cpu", "you"] as const) {
    const lineY = side === "cpu" ? CPU_STRIKER_LINE_Y : STRIKER_LINE_Y;
    const active = side === activeSide;
    ctx.save();
    ctx.strokeStyle = active ? "rgba(138,255,193,0.72)" : "rgba(160,107,255,0.24)";
    ctx.shadowColor = active ? "#8affc1" : "#a06bff";
    ctx.shadowBlur = active ? 12 : 4;
    ctx.lineWidth = active ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(STRIKER_MIN_X - 40, lineY);
    ctx.lineTo(STRIKER_MAX_X + 40, lineY);
    ctx.stroke();
    ctx.restore();
  }

  // pockets
  for (const k of POCKETS) {
    const g = ctx.createRadialGradient(k.x, k.y, 2, k.x, k.y, POCKET_R + 14);
    g.addColorStop(0, "#000");
    g.addColorStop(0.7, "rgba(255,46,154,0.5)");
    g.addColorStop(1, "rgba(255,46,154,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(k.x, k.y, POCKET_R + 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#050308";
    ctx.beginPath();
    ctx.arc(k.x, k.y, POCKET_R, 0, Math.PI * 2);
    ctx.fill();
  }

  // aim guide
  const s = pieces.find((p) => p.kind === "striker");
  if (phase === "aim" && drag && s) {
    const dx = s.x - drag.x;
    const dy = s.y - drag.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 8) {
      const end = firstAimHit(s, pieces, dx / dist, dy / dist);
      ctx.save();
      ctx.strokeStyle = "rgba(57,230,255,0.85)";
      ctx.shadowColor = "#39e6ff";
      ctx.shadowBlur = 16;
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.restore();

      // power meter
      const power = Math.min(dist / 170, 1);
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(BOARD_X + 40, BOARD_B + 40);
      ctx.lineTo(BOARD_R - 40, BOARD_B + 40);
      ctx.stroke();
      ctx.strokeStyle = power > 0.75 ? "#ff2e9a" : "#8affc1";
      ctx.shadowColor = ctx.strokeStyle as string;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(BOARD_X + 40, BOARD_B + 40);
      ctx.lineTo(BOARD_X + 40 + (BOARD_R - BOARD_X - 80) * power, BOARD_B + 40);
      ctx.stroke();
      ctx.restore();

    }
  }

  // pieces
  for (const p of pieces) {
    if (!p.alive) continue;
    const c = COLORS[p.kind];
    if (!c) continue;
    ctx.save();
    ctx.shadowColor = c.glow;
    ctx.shadowBlur = 24;
    ctx.fillStyle = "rgba(2, 2, 8, 0.72)";
    hexagon(ctx, p.x, p.y + 5, p.r);
    ctx.fill();
    ctx.fillStyle = c.fill;
    hexagon(ctx, p.x, p.y, p.r);
    ctx.fill();
    const shine = ctx.createLinearGradient(p.x - p.r, p.y - p.r, p.x + p.r, p.y + p.r);
    shine.addColorStop(0, "rgba(255,255,255,0.72)");
    shine.addColorStop(0.42, "rgba(255,255,255,0.08)");
    shine.addColorStop(1, "rgba(0,0,0,0.3)");
    ctx.fillStyle = shine;
    hexagon(ctx, p.x, p.y, Math.max(4, p.r - 3));
    ctx.fill();
    ctx.strokeStyle = c.glow;
    ctx.lineWidth = p.kind === "striker" ? 3.5 : 2.5;
    hexagon(ctx, p.x, p.y, Math.max(3, p.r - 2));
    ctx.stroke();
    if (p.kind === "queen") {
      ctx.save();
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#ffffff";
      star(ctx, p.x, p.y, p.r * 0.55, p.r * 0.22);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // sparks
  for (const sp of sparks) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, sp.life));
    ctx.strokeStyle = sp.color;
    ctx.shadowColor = sp.color;
    ctx.shadowBlur = 20;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, (1.4 - sp.life) * 26 + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function firstAimHit(strikerPiece: Piece, pieces: Piece[], dx: number, dy: number) {
  const wallTimes = [
    dx > 0 ? (BOARD_R - strikerPiece.r - strikerPiece.x) / dx : Number.POSITIVE_INFINITY,
    dx < 0 ? (BOARD_X + strikerPiece.r - strikerPiece.x) / dx : Number.POSITIVE_INFINITY,
    dy > 0 ? (BOARD_B - strikerPiece.r - strikerPiece.y) / dy : Number.POSITIVE_INFINITY,
    dy < 0 ? (BOARD_Y + strikerPiece.r - strikerPiece.y) / dy : Number.POSITIVE_INFINITY,
  ].filter((time) => time > 0);
  let nearest = Math.min(...wallTimes, 900);

  for (const piece of pieces) {
    if (piece === strikerPiece || !piece.alive) continue;
    const relX = piece.x - strikerPiece.x;
    const relY = piece.y - strikerPiece.y;
    const projection = relX * dx + relY * dy;
    if (projection <= 0 || projection >= nearest) continue;
    const radius = strikerPiece.r + piece.r;
    const perpendicularSq = relX * relX + relY * relY - projection * projection;
    if (perpendicularSq > radius * radius) continue;
    const hitTime = projection - Math.sqrt(Math.max(0, radius * radius - perpendicularSq));
    if (hitTime > 0 && hitTime < nearest) nearest = hitTime;
  }

  return { x: strikerPiece.x + dx * nearest, y: strikerPiece.y + dy * nearest };
}

function hexagon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function star(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerR: number,
  innerR: number,
) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
