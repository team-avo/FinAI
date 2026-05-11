import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, sendTextMessage } from "@/lib/whatsapp/client";
import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { agentToolsWhatsApp } from "@/lib/ai/tools/whatsapp";
import { buildSystemPrompt } from "@/lib/ai/prompts/system";
import { db } from "@/lib/db/client";
import { aiConversations, aiMessages } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "OK");
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";

  if (process.env.NODE_ENV === "production" && !verifyWebhookSignature(body, signature)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = JSON.parse(body);

  try {
    const entry = payload?.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message) {
      return NextResponse.json({ status: "ok" });
    }

    const from = message.from as string;
    const msgType = message.type as string;
    let userText = "";

    if (msgType === "text") {
      userText = message.text?.body ?? "";
    } else if (msgType === "image" || msgType === "document") {
      userText = `[User sent a ${msgType}] Please parse this bill/receipt and help record it as an expense.`;
    } else {
      return NextResponse.json({ status: "ok" });
    }

    if (!userText.trim()) return NextResponse.json({ status: "ok" });

    const [existing] = await db
      .select()
      .from(aiConversations)
      .where(and(eq(aiConversations.orgId, "advertout"), eq(aiConversations.contactHandle, from)))
      .limit(1);

    let convId = existing?.id;
    if (!convId) {
      const [conv] = await db
        .insert(aiConversations)
        .values({ orgId: "advertout", channel: "whatsapp", contactHandle: from })
        .returning();
      convId = conv.id;
    }

    const recentMessages = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, convId))
      .limit(20);

    await db.insert(aiMessages).values({
      conversationId: convId,
      role: "user",
      content: userText,
    });

    const history = recentMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    history.push({ role: "user", content: userText });

    const result = await streamText({
      model: google("gemini-2.0-flash"),
      system: buildSystemPrompt(),
      messages: history,
      tools: agentToolsWhatsApp,
      temperature: 0.1,
    });

    let responseText = "";
    for await (const chunk of result.textStream) {
      responseText += chunk;
    }

    if (responseText.trim()) {
      await sendTextMessage({ to: from, text: responseText });
      await db.insert(aiMessages).values({
        conversationId: convId,
        role: "assistant",
        content: responseText,
      });
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
