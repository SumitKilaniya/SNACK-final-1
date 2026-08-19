/**
 * Next.js server instrumentation — runs once when the server starts and is
 * awaited BEFORE the server accepts requests. This is where the startup gate
 * (env validation + DB probe) is guaranteed to run at true boot, not lazily
 * on first request.
 *
 * The gate lives in src/lib/env.ts; `startupGate` is awaited here so a fatal
 * problem exits the process with a clear message before anything is served.
 * The root layout also imports the module as a fallback for any runtime that
 * skips this hook (module cache means the checks still run exactly once).
 */
export async function register() {
  const { startupGate } = await import('@/lib/env');
  await startupGate;
}
