import { Info, ShieldCheck } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { VERIFY_METHODS, type VerifyMethod } from "@/lib/verification-info";

export function VerifyInfoButton({ method, gameName }: { method: VerifyMethod; gameName: string }) {
  const m = VERIFY_METHODS[method];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={`How ${gameName} scores are verified`}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Info className="size-4" aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
            {gameName}: {m.name}
          </DialogTitle>
          <DialogDescription>{m.protection}</DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
          {m.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          Only rounds that start and finish inside the league's time window count. Your best score is used.
        </p>
      </DialogContent>
    </Dialog>
  );
}
