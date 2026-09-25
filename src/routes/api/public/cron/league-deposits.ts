import { createFileRoute } from "@tanstack/react-router";

// Safe to trigger: it only re-checks recorded deposits against the blockchain
// and credits each verified transaction exactly once. Caller must send the
// project's publishable key (used by the scheduler).
export const Route = createFileRoute("/api/public/cron/league-deposits")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey");
        const allowed = [
          process.env["SUPABASE_PUBLISHABLE_KEY"],
          process.env["SUPABASE_ANON_KEY"],
          import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined,
        ].filter(Boolean);
        if (!key || !allowed.includes(key)) return new Response("Unauthorized", { status: 401 });
        const { processPending } = await import("@/lib/league-deposits.server");
        const r = await processPending();
        const { processPendingPurchases } = await import("@/lib/purchases.server");
        const purchases = await processPendingPurchases();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.rpc("disarm_league_deposit_checker");
        return Response.json({ ...r, purchases });
      },
    },
  },
});
