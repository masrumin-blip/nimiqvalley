import { createMiddleware } from "@tanstack/react-start";

import { PLAYER_TOKEN_HEADER, readPlayerToken } from "./player-token";

/** Sends the stored player token with every server function call. */
export const attachPlayerToken = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = readPlayerToken();
  return next({ headers: token ? { [PLAYER_TOKEN_HEADER]: token } : {} });
});
