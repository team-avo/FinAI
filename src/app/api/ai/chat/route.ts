import { streamText, convertToModelMessages } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { agentTools } from "@/lib/ai/tools";
import { buildSystemPrompt } from "@/lib/ai/prompts/system";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: buildSystemPrompt(),
    messages: modelMessages,
    tools: agentTools,
    temperature: 0.1,
  });

  return result.toTextStreamResponse();
}
