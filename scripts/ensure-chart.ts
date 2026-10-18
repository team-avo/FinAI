/**
 * Idempotent deploy step: guarantees the org exists and has a chart of
 * accounts, so expenses/invoices can actually post. Seeds the chart only when
 * it's missing, so it's safe to run on every build. Invoked from post-build.ts.
 */
import { ensureOrgSeeded } from "../src/lib/db/seed";

ensureOrgSeeded()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("ensure-chart failed:", e);
    process.exit(1);
  });
