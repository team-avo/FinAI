import { tool } from "ai";
import { z } from "zod";
import { agentTools } from "./index";
import { enqueueApproval } from "@/lib/trpc/routers/approvals";
import { logActivity } from "@/lib/trpc/routers/activity";
import { formatINR } from "@/lib/utils";

const ORG_ID = "advertout";
const APPROVAL_THRESHOLD_INR = 5000;

// Expenses from WhatsApp that meet threshold go to approval queue instead of auto-recording.
const recordExpenseWithApproval = tool({
  description:
    "Record a business expense. Amounts ≥ ₹5,000 are queued for human approval before being posted.",
  inputSchema: z.object({
    date: z.string().describe("Date in YYYY-MM-DD format, defaults to today"),
    vendorName: z.string().optional().describe("Vendor or merchant name"),
    categoryDescription: z.string().describe("Description of the expense category"),
    amount: z.number().positive().describe("Base amount before tax in INR"),
    cgst: z.number().min(0).describe("CGST amount"),
    sgst: z.number().min(0).describe("SGST amount"),
    igst: z.number().min(0).describe("IGST amount"),
    notes: z.string().optional(),
  }),
  execute: async (input) => {
    const total = input.amount + input.cgst + input.sgst + input.igst;

    if (total >= APPROVAL_THRESHOLD_INR) {
      const approval = await enqueueApproval({
        orgId: ORG_ID,
        type: "expense_record",
        payload: { ...input, totalAmount: total },
        confidence: 80,
        sourceChannel: "whatsapp",
      });

      await logActivity({
        orgId: ORG_ID,
        actor: "ai_whatsapp",
        action: "tool:recordExpense:queued",
        entityType: "approval",
        entityRef: approval.id,
        input: { vendorName: input.vendorName, amount: input.amount, total },
        output: { approvalId: approval.id },
      }).catch(() => {});

      return `Expense of ${formatINR(total)}${input.vendorName ? ` from ${input.vendorName}` : ""} queued for approval (above ₹5,000 threshold). Your accountant will review it shortly.`;
    }

    // Below threshold — execute normally via the standard tool
    const exec = agentTools.recordExpense.execute;
    if (!exec) throw new Error("recordExpense.execute not defined");
    return exec(input, {} as never);
  },
});

export const agentToolsWhatsApp = {
  ...agentTools,
  recordExpense: recordExpenseWithApproval,
};
