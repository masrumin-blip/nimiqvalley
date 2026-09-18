import { Trophy } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ResultRow {
  wallet: string;
  name: string;
  isYou: boolean;
  /** Ordered stat chips, best-to-worst rows come pre-sorted by the caller. */
  stats: Array<{ label: string; value: string }>;
}

interface Props {
  open: boolean;
  title: string;
  subtitle?: string;
  rows: ResultRow[];
  onPlayAgain?: () => void;
  onExit: () => void;
}

/** Shared end-of-match stats popup, ranked best to worst. */
export function MatchResultDialog({
  open,
  title,
  subtitle,
  rows,
  onPlayAgain,
  onExit,
}: Props) {
  return (
    <Dialog open={open}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="size-5 text-primary" />
            {title}
          </DialogTitle>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
        </DialogHeader>

        <ol className="space-y-2">
          {rows.map((row, i) => (
            <li
              key={row.wallet}
              className={`rounded-lg border p-3 ${
                row.isYou ? "border-primary/60 bg-primary/5" : "border-border/60 bg-card/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">
                  {i + 1}. {row.name}
                  {row.isYou ? " (you)" : ""}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {row.stats.map((s) => (
                  <span key={s.label}>
                    {s.label}: <span className="text-foreground">{s.value}</span>
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ol>

        <DialogFooter className="gap-2 sm:gap-2">
          {onPlayAgain ? (
            <Button className="flex-1" onClick={onPlayAgain}>
              Play again
            </Button>
          ) : null}
          <Button variant="outline" className="flex-1" onClick={onExit}>
            Game Hub
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
