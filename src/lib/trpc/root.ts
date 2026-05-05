import { router } from "./init";
import { contactsRouter } from "./routers/contacts";
import { itemsRouter } from "./routers/items";
import { invoicesRouter } from "./routers/invoices";
import { expensesRouter } from "./routers/expenses";
import { reportsRouter } from "./routers/reports";
import { dashboardRouter } from "./routers/dashboard";
import { settingsRouter } from "./routers/settings";
import { paymentsRouter } from "./routers/payments";

export const appRouter = router({
  contacts: contactsRouter,
  items: itemsRouter,
  invoices: invoicesRouter,
  expenses: expensesRouter,
  reports: reportsRouter,
  dashboard: dashboardRouter,
  settings: settingsRouter,
  payments: paymentsRouter,
});

export type AppRouter = typeof appRouter;
