import { groq } from "@ai-sdk/groq";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { buildSystemPrompt } from "@/lib/ai/prompts/system";
import { buildAgentTools } from "@/lib/ai/tools";
import { buildDraftZohoInvoice } from "@/lib/ai/tools/zoho-invoice";
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

  // Web-chat invoicing by chat is opt-in: when ZOHO_INVOICING_WEB is set, the
  // real Zoho Books draft flow replaces the local-DB createInvoice tool, so a
  // "bill this client" request drafts in Zoho and queues an approval that emails
  // on sign-off (from the Approvals tab). Off by default — prod is unchanged
  // until the flag is set, and orgs without a Zoho connection get a clear
  // "connect Zoho first" message from the tool itself.
  const zohoInvoicing = process.env.ZOHO_INVOICING_WEB === "1";

  const baseTools = buildAgentTools(sess.orgId);
  const tools = zohoInvoicing
    ? (() => {
        const { createInvoice: _localCreateInvoice, ...rest } = baseTools;
        return {
          ...rest,
          draftZohoInvoice: buildDraftZohoInvoice({ orgId: sess.orgId, userId: sess.userId }),
        };
      })()
    : baseTools;

  const result = streamText({
    model: groq("openai/gpt-oss-120b"),
    system: buildSystemPrompt("AdvertOut", { zohoInvoicing }),
    messages: modelMessages,
    tools,
    temperature: 0.1,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
