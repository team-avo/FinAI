import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Books that keep themselves",
  description:
    "AI-native accounting for Indian small businesses. Run your books on WhatsApp — snap a bill, send a voice note, type a line, and FinAI keeps real, GST-ready books.",
};

export default function Page() {
  return <LandingPage />;
}
