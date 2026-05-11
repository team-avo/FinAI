import { NextRequest, NextResponse } from "next/server";
import { agentToolsWhatsApp } from "@/lib/ai/tools/whatsapp";
import { buildSystemPrompt } from "@/lib/ai/prompts/system";
import { streamText } from "ai";
import { google } from "@ai-sdk/google";

export const runtime = "nodejs";

// Dev-only endpoint for testing WhatsApp message processing without Meta webhook.
// Only available when WHATSAPP_DRY_RUN=1 is set.
export async function POST(req: NextRequest) {
  if (process.env.WHATSAPP_DRY_RUN !== "1" || process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { message, phone = "+919999999999" } = await req.json() as { message: string; phone?: string };

  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const result = await streamText({
    model: google("gemini-2.0-flash"),
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: message }],
    tools: agentToolsWhatsApp,
    temperature: 0.1,
  });

  let responseText = "";
  for await (const chunk of result.textStream) {
    responseText += chunk;
  }

  const toolResults: unknown[] = [];
  for await (const step of (await result.steps)) {
    if (step.toolResults?.length) {
      toolResults.push(...step.toolResults);
    }
  }

  return NextResponse.json({
    from: phone,
    message,
    response: responseText,
    toolResults,
  });
}
