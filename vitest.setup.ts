// Load local env (DATABASE_URL etc.) so DB-gated integration tests can run.
// In CI without a .env.local, those tests skip.
try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local — DB-gated tests will skip */
}
