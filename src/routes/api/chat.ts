import { createOpenAI } from "@ai-sdk/openai";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { z } from "zod";

import { getCharacter } from "@/lib/characters";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayResponseHeaders,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";

/** Bounds the message history a player can send to the AI. */
const MAX_MESSAGES = 20;
const MAX_MESSAGES_CHARS = 24_000;

const chatBodySchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())).min(1),
  characterId: z.unknown(),
});

/** Keeps only the newest messages that fit the size budget. */
function trimMessages(messages: unknown[]): unknown[] {
  const recent = messages.slice(-MAX_MESSAGES);
  let kept = recent;
  while (kept.length > 1 && JSON.stringify(kept).length > MAX_MESSAGES_CHARS) {
    kept = kept.slice(1);
  }
  return kept;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = chatBodySchema.safeParse(await request.json());
        if (!parsed.success) {
          return new Response("Messages are required", { status: 400 });
        }
        const messages = trimMessages(parsed.data.messages);
        const characterId = parsed.data.characterId;
        const character = typeof characterId === "string" ? getCharacter(characterId) : undefined;
        if (!character) {
          return new Response("Unknown character", { status: 400 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Lovable AI is not configured.", { status: 500 });

        const { currentWallet } = await import("@/lib/session.server");
        const wallet = await currentWallet();
        if (!wallet) return new Response("Sign in with your wallet first", { status: 401 });

        const { spendChat, refundChat } = await import("@/lib/credits.server");
        let spentSource: "free" | "paid";
        try {
          ({ source: spentSource } = await spendChat(wallet));
        } catch (err) {
          return new Response(err instanceof Error ? err.message : "No chat messages left", {
            status: 402,
          });
        }
        /** Gives the chat message back when the AI never got to answer. */
        const giveBack = () => {
          void refundChat(wallet, spentSource).catch(() => {});
        };

        const initialRunId = getLovableAiGatewayRunId(request);
        const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
        const lovable = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey: key,
          headers: {
            "Lovable-API-Key": key,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          },
          fetch: runIdFetch.fetch,
        });

        const system = [
          character.persona,
          "You live in Nimiq Valley, a warm storybook village. Stay in character at all times and never mention being an AI, a model, or a system prompt.",
          "Always answer in English, whatever language the visitor writes in.",
          "Keep replies to 1-3 short sentences, conversational, with no markdown headings or bullet lists.",
        ].join("\n\n");

        try {
          const result = streamText({
            model: lovable.responses("openai/gpt-6-astra"),
            system,
            messages: await convertToModelMessages(messages as UIMessage[]),
            maxRetries: 0,
            abortSignal: request.signal,
            providerOptions: {
              openai: {
                forceReasoning: true,
                reasoningEffort: "medium",
                reasoningSummary: "auto",
                store: false,
                include: ["reasoning.encrypted_content"],
              },
            },
          });

          return withLovableAiGatewayRunIdHeader(
            result.toUIMessageStreamResponse({
              originalMessages: messages as UIMessage[],
              sendReasoning: true,
              headers: getLovableAiGatewayResponseHeaders(undefined, {
                ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}),
              }),
              onError: (error) => {
                if (!(error instanceof Error && error.name === "AbortError")) giveBack();
                return error instanceof Error
                  ? error.message
                  : "Lovable AI could not answer this request.";
              },
            }),
            runIdFetch,
          );
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            return new Response(null, { status: 499 });
          }
          giveBack();
          const status =
            typeof (err as { statusCode?: number })?.statusCode === "number"
              ? (err as { statusCode: number }).statusCode
              : 502;
          return new Response(
            err instanceof Error ? err.message : "Lovable AI could not answer this request.",
            { status },
          );
        }
      },
    },
  },
});
