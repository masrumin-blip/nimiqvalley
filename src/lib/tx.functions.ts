import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Computes the Nimiq transaction hash on the server.
 * Keeps @nimiq/core (WASM) out of the client bundle.
 */
export const hashTransaction = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ serialized: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const nimiqCore = await import("@nimiq/core/web");
    await nimiqCore.default();
    return { hash: nimiqCore.Transaction.fromAny(data.serialized).hash() };
  });
