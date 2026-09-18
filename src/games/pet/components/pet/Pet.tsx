import { useState } from "react";
import type { Mood } from "@/games/pet/game/types";
import { cn } from "@/lib/utils";
import petIdle from "@/games/pet/assets/pet-idle.webp";
import petBlink from "@/games/pet/assets/pet-blink.webp";
import petEating from "@/games/pet/assets/pet-eating.webp";
import petTired from "@/games/pet/assets/pet-tired.webp";
import petHungry from "@/games/pet/assets/pet-hungry.webp";
import petSad from "@/games/pet/assets/pet-sad.webp";
import petSleeping from "@/games/pet/assets/pet-sleeping.webp";

interface PetProps {
  mood: Mood;
  hat: string | null;
  glasses: string | null;
  dirt?: number;
  chewing?: boolean;
  className?: string;
  onTap?: () => void;
  /** Extra squish when the pet is being scrubbed etc. */
  wobble?: boolean;
  washing?: boolean;
  cleanSparkle?: boolean;
  playing?: boolean;
}

/** Percentage positions on the pet image, kept away from the face. */
const SMUDGES = [
  { x: 26, y: 62, r: 6 },
  { x: 70, y: 66, r: 7 },
  { x: 48, y: 76, r: 6 },
  { x: 34, y: 72, r: 5 },
  { x: 66, y: 40, r: 4.5 },
  { x: 30, y: 38, r: 4.5 },
];


export function Pet({
  mood,
  hat,
  glasses,
  dirt = 0,
  chewing = false,
  className,
  onTap,
  wobble = false,
  washing = false,
  cleanSparkle = false,
  playing = false,
}: PetProps) {
  const [poke, setPoke] = useState(false);
  const [hearts, setHearts] = useState<number[]>([]);

  const handleTap = () => {
    setPoke(true);
    setTimeout(() => setPoke(false), 420);
    const id = Date.now() + Math.random();
    setHearts((h) => [...h, id]);
    setTimeout(() => setHearts((h) => h.filter((x) => x !== id)), 1100);
    onTap?.();
  };

  const sleeping = mood === "sleeping";
  const hungry = mood === "hungry";
  const sleepy = mood === "sleepy";
  const spriteFor = (): { src: string; label: string } => {
    if (chewing) return { src: petEating, label: "Nimiq pet sedang makan" };
    if (sleeping) return { src: petSleeping, label: "Nimiq pet sedang tidur" };
    if (sleepy) return { src: petTired, label: "Nimiq pet lelah, energy rendah" };
    if (hungry) return { src: petHungry, label: "Nimiq pet lapar" };
    if (mood === "sad" || mood === "dirty") return { src: petSad, label: "Nimiq pet sedih" };
    return { src: petIdle, label: "Nimiq pet sedang diam" };
  };
  const sprite = spriteFor();
  const canBlink = !chewing && !sleeping && !sleepy && !hungry && mood !== "sad" && mood !== "dirty";
  const smudgeCount = Math.round((dirt / 100) * SMUDGES.length);

  return (
    <div
      className={cn("relative select-none", className)}
    >
      {hearts.map((id, i) => (
        <span
          key={id}
          className="pointer-events-none absolute left-1/2 top-6 text-2xl"
          style={{
            animation: "pet-heart 1.1s ease-out forwards",
            marginLeft: `${(i % 3) * 26 - 26}px`,
          }}
        >
          {mood === "dirty" ? "💚" : "💗"}
        </span>
      ))}

      {chewing && (
        <div className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">
          <span className="pet-eating-ring absolute left-1/2 top-1/2 size-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-primary/45" />
          {Array.from({ length: 9 }).map((_, i) => (
            <span
              key={`crumb-${i}`}
              className="pet-crumb absolute size-1.5 rounded-full bg-amber-600"
              style={{
                left: `${29 + ((i * 9) % 43)}%`,
                top: `${48 + ((i * 7) % 18)}%`,
                animationDelay: `${(i % 5) * 60}ms`,
                "--crumb-x": `${i % 2 === 0 ? -12 - i * 2 : 12 + i * 2}px`,
              } as React.CSSProperties}
            />
          ))}
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={`spark-${i}`}
              className="pet-eating-sparkle absolute text-xl"
              style={{
                left: `${13 + ((i * 19) % 76)}%`,
                top: `${17 + ((i * 23) % 60)}%`,
                animationDelay: `${i * 95}ms`,
              }}
            >
              ✦
            </span>
          ))}
        </div>
      )}

      {hungry && !chewing && (
        <div className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">
          <span className="pet-hunger-icon absolute -left-1 top-[28%] text-3xl">🍎</span>
          <span className="pet-hunger-icon absolute right-0 top-[42%] text-2xl [animation-delay:0.7s]">🍞</span>
        </div>
      )}

      {sleepy && !sleeping && (
        <div className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">
          <span className="pet-sleepy-star absolute right-[9%] top-[18%] text-2xl">✦</span>
          <span className="pet-sleepy-star absolute left-[10%] top-[34%] text-lg [animation-delay:0.55s]">✦</span>
        </div>
      )}

      {playing && (
        <div className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">
          <span className="pet-play-streak absolute left-[8%] top-1/2 h-1 w-8 rounded-full bg-primary/55" />
          <span className="pet-play-streak absolute left-[3%] top-[62%] h-1 w-5 rounded-full bg-primary/35 [animation-delay:0.15s]" />
        </div>
      )}

      {cleanSparkle && (
        <div className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, i) => (
            <span
              key={i}
              className="pet-clean-sparkle absolute text-xl"
              style={{
                left: `${12 + ((i * 29) % 78)}%`,
                top: `${8 + ((i * 37) % 72)}%`,
                animationDelay: `${i * 90}ms`,
              }}
            >
              ✦
            </span>
          ))}
        </div>
      )}

      <div
        className={cn("pet-floor-shadow pointer-events-none absolute bottom-[1%] left-[22%] h-[7%] w-[56%] rounded-full bg-foreground/20 blur-sm", {
          "pet-floor-shadow-poke": poke,
          "pet-floor-shadow-rub": wobble,
          "pet-floor-shadow-sleep": sleeping,
        })}
      />

      <button
        type="button"
        aria-label="Pet your buddy"
        onClick={handleTap}
        className={cn("pet-body-motion relative z-10 block w-full cursor-pointer border-0 bg-transparent p-0", {
          "pet-body-poke": poke,
          "pet-body-rub": !poke && wobble,
          "pet-body-wash": !poke && washing && !wobble,
          "pet-body-sleep": !poke && sleeping,
          "pet-body-chew": !poke && chewing,
          "pet-body-play": !poke && playing,
          "pet-body-hungry": !poke && hungry && !washing && !chewing && !playing,
          "pet-body-sleepy": !poke && sleepy && !washing && !chewing && !playing,
          "pet-body-idle": !poke && !wobble && !washing && !sleeping && !chewing && !playing && !hungry && !sleepy,
        })}
      >
        <img
          src={sprite.src}
          alt={sprite.label}
          className={cn("h-full w-full object-contain drop-shadow-xl transition-[filter] duration-300", {
            "brightness-[0.97] saturate-90": !chewing && (mood === "sad" || mood === "hungry" || mood === "dirty"),
            "brightness-75": sleeping,
          })}
          draggable={false}
        />
        <img
          src={petBlink}
          alt=""
          aria-hidden="true"
          className={cn("pet-blink-image pointer-events-none absolute inset-0 h-full w-full object-contain drop-shadow-xl transition-[filter] duration-300", {
            "pet-blink-image-sleeping": sleeping,
            hidden: !canBlink,
            "brightness-[0.97] saturate-90": mood === "sad" || mood === "hungry" || mood === "dirty",
            "brightness-75": sleeping,
          })}
          draggable={false}
        />
        {!chewing &&
          SMUDGES.slice(0, smudgeCount).map((smudge, index) => (
            <span
              key={index}
              className="pointer-events-none absolute z-20 rounded-full bg-amber-900/25 blur-[2px]"
              style={{
                left: `${smudge.x}%`,
                top: `${smudge.y}%`,
                width: `${smudge.r}%`,
                aspectRatio: "1",
              }}
            />
          ))}

        <svg
          viewBox="0 0 501 455"
          preserveAspectRatio="xMidYMid meet"
          className={cn("pointer-events-none absolute inset-0 z-20 h-full w-full", chewing && "translate-y-[1.5%]")}
          aria-hidden="true"
        >
          {/* glasses */}
          {glasses === "round" && (
            <g stroke="currentColor" strokeWidth="8" fill="none" className="text-foreground">
              <circle cx="185" cy="158" r="36" />
              <circle cx="305" cy="158" r="36" />
              <path d="M221 158c18-10 30-10 48 0M149 151l-38-10M341 151l38-10" strokeLinecap="round" />
            </g>
          )}
          {glasses === "shades" && (
            <g className="text-foreground">
              <path d="M138 136h93v18c0 31-18 48-46 48s-43-20-47-66z" fill="currentColor" />
              <path d="M259 136h93c-4 46-19 66-47 66s-46-17-46-48z" fill="currentColor" />
              <path d="M227 151c15-8 31-8 36 0M138 145l-29-9M352 145l29-9" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
              <path d="M154 150h43" stroke="white" strokeWidth="7" opacity="0.4" strokeLinecap="round" />
            </g>
          )}
          {glasses === "star" && (
            <g fill="#ffd166" stroke="#9a6b18" strokeWidth="6" strokeLinejoin="round">
              <path d="M185 112l13 28 31 4-23 22 6 31-27-16-27 16 6-31-23-22 31-4z" />
              <path d="M305 112l13 28 31 4-23 22 6 31-27-16-27 16 6-31-23-22 31-4z" />
              <path d="M212 152c20-9 46-9 66 0" fill="none" />
            </g>
          )}

          {/* hats */}
          {hat === "cap" && (
            <g>
              <path d="M118 92Q245-8 369 90Z" fill="#e05c5c" stroke="#873b36" strokeWidth="8" />
              <path d="M351 82q73 0 91 31-102 16-197-10z" fill="#c94b4b" stroke="#873b36" strokeWidth="8" strokeLinejoin="round" />
            </g>
          )}
          {hat === "party" && (
            <g>
              <path d="M245 8l70 99H175z" fill="#f7a1c4" stroke="#9e4e73" strokeWidth="8" strokeLinejoin="round" />
              <circle cx="245" cy="9" r="15" fill="#ffe066" stroke="#9a6b18" strokeWidth="6" />
              <circle cx="220" cy="75" r="9" fill="#8ec5ff" />
              <circle cx="265" cy="56" r="9" fill="#85d998" />
            </g>
          )}
          {hat === "crown" && (
            <path
              d="M130 102l15-78 43 40 57-58 57 58 43-40 15 78z"
              fill="#ffd166"
              stroke="#9a6b18"
              strokeWidth="8"
              strokeLinejoin="round"
            />
          )}
          {hat === "bow" && (
            <g>
              <path d="M320 76q-76-57-87 7 12 53 87 17z" fill="#f77aa4" stroke="#a83f68" strokeWidth="8" />
              <path d="M320 76q76-57 87 7-12 53-87 17z" fill="#f77aa4" stroke="#a83f68" strokeWidth="8" />
              <circle cx="320" cy="87" r="19" fill="#ffb3ce" stroke="#a83f68" strokeWidth="8" />
            </g>
          )}
        </svg>
      </button>

      {sleeping && (
        <div className="pointer-events-none absolute inset-0 z-20 text-2xl font-bold text-foreground/70" aria-hidden="true">
          <span className="pet-zzz absolute right-[20%] top-[30%]">z</span>
          <span className="pet-zzz absolute right-[14%] top-[22%] [animation-delay:0.8s]">Z</span>
          <span className="pet-zzz absolute right-[8%] top-[12%] text-3xl [animation-delay:1.6s]">Z</span>
        </div>
      )}

      {washing && (
        <div className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="pet-wash-bubble absolute rounded-full border border-white/80 bg-white/40 shadow-sm"
              style={{
                left: `${12 + ((i * 31) % 76)}%`,
                top: `${24 + ((i * 23) % 58)}%`,
                width: `${12 + (i % 4) * 5}px`,
                height: `${12 + (i % 4) * 5}px`,
                animationDelay: `${i * 110}ms`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
