import { groq } from "@ai-sdk/groq";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { buildSystemPrompt } from "@/lib/ai/prompts/system";
import { buildAgentTools } from "@/lib/ai/tools";
import { getSessionOrg } from "@/lib/auth/session-org";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  // Capture and queries must run against the signed-in user's own org.
  const sess = await getSessionOrg(req);
  if (!sess) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const { messages } = await req.json();
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: groq("openai/gpt-oss-120b"),
    system: buildSystemPrompt(),
    messages: modelMessages,
    tools: buildAgentTools(sess.orgId),
    temperature: 0.1,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
