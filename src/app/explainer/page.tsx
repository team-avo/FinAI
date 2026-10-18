import type { Metadata } from "next";
import { Explainer } from "@/components/explainer/explainer";

export const metadata: Metadata = {
  title: "FinAI, explained",
  description:
    "A plain-English, interactive walkthrough of FinAI for investors — how a WhatsApp message becomes GST-correct books, why it's different from everything else, and why now.",
};

export default function Page() {
  return <Explainer />;
}
