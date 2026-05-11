import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { groq } from "@ai-sdk/groq";
import { agentTools } from "@/lib/ai/tools";
import { buildSystemPrompt } from "@/lib/ai/prompts/system";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: groq("llama-3.3-70b-versatile"),
    system: buildSystemPrompt(),
    messages: modelMessages,
    tools: agentTools,
    temperature: 0.1,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
