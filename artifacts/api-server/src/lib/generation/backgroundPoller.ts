import { inArray, eq } from "drizzle-orm";
import { db, generationsTable, modelsTable } from "@workspace/db";
import { syncGenerationStatus } from "./statusSync";

interface PollerLogger {
  error: (obj: Record<string, unknown>, msg?: string) => void;
}

const POLL_INTERVAL_MS = 15_000;

// Makes generation completion independent of any browser staying open.
// Client-side polling in the React app is purely cosmetic (a nicer
// live-updating UI while the user is present) — this interval is the actual
// source of truth. It runs inside the long-lived API server process itself
// (this app has no separate worker/cron infrastructure), so it keeps
// checking in-flight generations against the provider even if every user
// closes their tab mid-generation.
export function startGenerationBackgroundPoller(log: PollerLogger): () => void {
  let running = false;

  const tick = async () => {
    if (running) return; // don't overlap ticks if one run takes longer than the interval
    running = true;
    try {
      const rows = await db
        .select()
        .from(generationsTable)
        .innerJoin(modelsTable, eq(generationsTable.modelId, modelsTable.id))
        .where(inArray(generationsTable.status, ["pending", "processing"]));

      for (const row of rows) {
        await syncGenerationStatus(row.generations, row.models, log);
      }
    } catch (err) {
      log.error({ err }, "Generation background poller tick failed");
    } finally {
      running = false;
    }
  };

  const interval = setInterval(tick, POLL_INTERVAL_MS);
  interval.unref();
  void tick(); // catch up immediately on startup (e.g. generations left "processing" from before a restart)

  return () => clearInterval(interval);
}
