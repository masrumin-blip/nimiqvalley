import { createOpenAI } from "@ai-sdk/openai";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { getCharacter } from "@/lib/characters";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayResponseHeaders,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";

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

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Lovable AI is not configured.", { status: 500 });

        const { currentWallet } = await import("@/lib/session.server");
        const wallet = await currentWallet();
        if (!wallet) return new Response("Sign in with your wallet first", { status: 401 });

        const { spendChat } = await import("@/lib/credits.server");
        try {
          await spendChat(wallet);
        } catch (err) {
          return new Response(
            err instanceof Error ? err.message : "No chat messages left",
            { status: 402 },
          );
        }

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

        const { listAiMessages, saveAiMessage } = await import("@/lib/ai-chat.server");
        const uiMessages = messages as UIMessage[];
        const lastUser = [...uiMessages].reverse().find((m) => m.role === "user");
        const lastUserText = lastUser
          ? lastUser.parts
              .map((part) => (part.type === "text" ? part.text : ""))
              .join("")
              .trim()
          : "";
        if (lastUserText) await saveAiMessage(wallet, character.id, "user", lastUserText);

        // The saved conversation is the source of truth, so the model always
        // sees every earlier turn even after a reload.
        const stored = await listAiMessages(wallet, character.id);
        const modelMessages = stored.map((row) => ({
          id: row.id,
          role: row.role,
          parts: [{ type: "text" as const, text: row.text }],
        })) as UIMessage[];

        try {
          const result = streamText({
            model: lovable.responses("openai/gpt-6-astra"),
            system,
            messages: await convertToModelMessages(
              modelMessages.length > 0 ? modelMessages : uiMessages,
            ),
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
              originalMessages: uiMessages,
              sendReasoning: true,
              onFinish: async ({ responseMessage }) => {
                const text = responseMessage.parts
                  .map((part) => (part.type === "text" ? part.text : ""))
                  .join("")
                  .trim();
                if (text) await saveAiMessage(wallet, character.id, "assistant", text);
              },
              headers: getLovableAiGatewayResponseHeaders(undefined, {
                ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}),
              }),
              onError: (error) =>
                error instanceof Error ? error.message : "Lovable AI could not answer this request.",
            }),
            runIdFetch,
          );
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            return new Response(null, { status: 499 });
          }
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
