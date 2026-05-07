"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { DashboardGrid } from "@/components/dashboard/grid/dashboard-grid";
import { OnboardingModal } from "@/components/dashboard/onboarding/onboarding-modal";

export default function DashboardPage() {
  const layoutQuery = trpc.dashboards.getMyLayout.useQuery();
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  useEffect(() => {
    if (layoutQuery.data && !layoutQuery.data.onboardingCompleted) {
      setOnboardingOpen(true);
    }
  }, [layoutQuery.data]);

  return (
    <div className="max-w-[1400px] mx-auto">
      <DashboardGrid />
      <OnboardingModal open={onboardingOpen} onComplete={() => setOnboardingOpen(false)} />
    </div>
  );
}
