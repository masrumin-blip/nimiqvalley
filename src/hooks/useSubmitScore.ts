import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useRef } from "react";

import { submitScore } from "@/lib/leaderboard.functions";

/**
 * Returns a stable `report(value)` callback that sends a finished round's result
 * to the global leaderboard. The server keeps only the player's best result.
 */
export function useSubmitScore(slug: string) {
  const send = useServerFn(submitScore);
  const queryClient = useQueryClient();
  const lastSent = useRef<number | null>(null);

  return useCallback(
    (value: number) => {
      if (!Number.isFinite(value) || value < 0) return;
      if (lastSent.current === value) return;
      lastSent.current = value;
      void send({ data: { slug, value } })
        .then((res) => {
          if (res?.saved) queryClient.invalidateQueries({ queryKey: ["leaderboard", slug] });
        })
        .catch((err) => console.error("submitScore failed", err));
    },
    [send, slug, queryClient],
  );
}
