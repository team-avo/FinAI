import { router } from "./init";
import { contactsRouter } from "./routers/contacts";
import { itemsRouter } from "./routers/items";
import { invoicesRouter } from "./routers/invoices";
import { expensesRouter } from "./routers/expenses";
import { reportsRouter } from "./routers/reports";
import { dashboardRouter } from "./routers/dashboard";
import { settingsRouter } from "./routers/settings";
import { paymentsRouter } from "./routers/payments";
import { dashboardsRouter } from "./routers/dashboards";
import { aggregateRouter } from "./routers/aggregate";
import { notificationsRouter } from "./routers/notifications";
import { approvalsRouter } from "./routers/approvals";
import { activityRouter } from "./routers/activity";
import { briefingsRouter } from "./routers/briefings";
import { zohoRouter } from "./routers/zoho";

export const appRouter = router({
  contacts: contactsRouter,
  items: itemsRouter,
  invoices: invoicesRouter,
  expenses: expensesRouter,
  reports: reportsRouter,
  dashboard: dashboardRouter,
  settings: settingsRouter,
  payments: paymentsRouter,
  dashboards: dashboardsRouter,
  aggregate: aggregateRouter,
  notifications: notificationsRouter,
  approvals: approvalsRouter,
  activity: activityRouter,
  briefings: briefingsRouter,
  zoho: zohoRouter,
});

export type AppRouter = typeof appRouter;
