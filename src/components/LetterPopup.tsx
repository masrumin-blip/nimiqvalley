import { useEffect, useState } from "react";
import { X } from "lucide-react";

import type { Letter } from "@/lib/letters";
import { shortAddr } from "@/lib/letters";

interface Props {
  letter: Letter | null;
  notForYou?: boolean;
  onOpened?: (id: string) => void;
  onClose: () => void;
}

/** Parchment letter with a wax seal that the reader taps to open. */
export default function LetterPopup({ letter, notForYou, onOpened, onClose }: Props) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [letter?.id]);

  const explorer =
    letter?.txHash && letter.token === "usdt"
      ? `https://polygonscan.com/tx/${letter.txHash}`
      : letter?.txHash
        ? `https://nimiq.watch/#${letter.txHash}`
        : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-sm animate-in zoom-in-95 duration-500">
        <button
          type="button"
          aria-label="Close letter"
          onClick={onClose}
          className="absolute -right-2 -top-2 z-10 grid size-11 place-items-center rounded-full border border-amber-800/40 bg-amber-50 text-amber-900 shadow"
        >
          <X className="size-5" />
        </button>

        <div className="relative overflow-hidden rounded-2xl border-2 border-amber-800/30 bg-gradient-to-b from-amber-50 via-amber-100 to-amber-200 p-6 text-amber-950 shadow-2xl">
          <div className="pointer-events-none absolute inset-3 rounded-xl border border-dashed border-amber-800/25" />

          {notForYou ? (
            <div className="py-8 text-center">
              <p className="font-serif text-xl font-bold">This letter is for someone else</p>
              <p className="mt-2 text-sm text-amber-900/70">Only the recipient's wallet can open it.</p>
            </div>
          ) : !letter ? (
            <p className="py-8 text-center font-serif text-lg">Letter not found.</p>
          ) : !open ? (
            <div className="flex flex-col items-center py-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-900/70">Nimiq Village Post</p>
              <p className="mt-2 font-serif text-2xl font-bold">You've got a letter!</p>
              <p className="mt-1 text-sm text-amber-900/70">from {shortAddr(letter.from)}</p>
              <button
                type="button"
                onClick={() => {
                  setOpen(true);
                  onOpened?.(letter.id);
                }}
                aria-label="Break the seal"
                className="group relative mt-6 grid size-24 place-items-center rounded-full bg-gradient-to-br from-yellow-300 via-amber-500 to-amber-700 shadow-[0_6px_20px_rgba(146,64,14,0.45)] transition-transform hover:scale-105 active:scale-95"
              >
                <span className="absolute inset-2 rounded-full border-2 border-yellow-200/60" />
                <span className="font-serif text-3xl font-black text-amber-50 drop-shadow">N</span>
                <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/20" />
              </button>
              <p className="mt-4 text-xs text-amber-900/70">Tap the seal to open</p>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-900/70">Dear friend,</p>
              <p className="mt-3 whitespace-pre-wrap break-words font-serif text-lg leading-relaxed">{letter.message}</p>
              <p className="mt-4 text-right font-serif text-sm italic text-amber-900/80">— {shortAddr(letter.from)}</p>
              {letter.token !== "none" && (
                <div className="relative mt-5 overflow-hidden rounded-xl border border-amber-700/40 bg-amber-50/80 p-3 text-center">
                  <span className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-yellow-200/50 to-transparent" />
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-800">Attached gift</p>
                  <p className="font-serif text-2xl font-black">
                    {letter.amount.toLocaleString()} {letter.token === "nim" ? "NIM" : "USDT"}
                  </p>
                  <p className="text-[11px] text-amber-900/70">Already in your wallet</p>
                  {explorer && (
                    <a href={explorer} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold underline">
                      View transaction
                    </a>
                  )}
                </div>
              )}
              <p className="mt-4 text-center text-[11px] text-amber-900/60">
                {new Date(letter.createdAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
