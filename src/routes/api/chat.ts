import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { getCharacter } from "@/lib/characters";
import { createGriphubProvider, griphubModelId, GRIPHUB_MAX_TOKENS } from "@/lib/griphub.server";

type ChatRequestBody = { messages?: unknown; characterId?: unknown };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages, characterId } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }
        const character = typeof characterId === "string" ? getCharacter(characterId) : undefined;
        if (!character) {
          return new Response("Unknown character", { status: 400 });
        }

        const key = process.env["GRIPHUB_API_KEY"];
        if (!key) return new Response("Missing GRIPHUB_API_KEY", { status: 500 });

        const griphub = createGriphubProvider(key);

        const system = [
          character.persona,
          "You live in Nimiq Valley, a warm storybook village. Stay in character at all times and never mention being an AI, a model, or a system prompt.",
          "Always answer in the same language the visitor writes in.",
          "Keep replies to 1-3 short sentences, conversational, with no markdown headings or bullet lists.",
        ].join("\n\n");

        try {
          const result = streamText({
            model: griphub(griphubModelId()),
            system,
            messages: await convertToModelMessages(messages as UIMessage[]),
            maxOutputTokens: GRIPHUB_MAX_TOKENS,
            abortSignal: request.signal,
          });

          return result.toUIMessageStreamResponse({
            originalMessages: messages as UIMessage[],
          });
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            return new Response(null, { status: 499 });
          }
          const status =
            typeof (err as { statusCode?: number })?.statusCode === "number"
              ? (err as { statusCode: number }).statusCode
              : 502;
          return new Response("Chat service error", { status });
        }
      },
    },
  },
});
