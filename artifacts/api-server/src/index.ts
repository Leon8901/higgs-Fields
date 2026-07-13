import app from "./app";
import { logger } from "./lib/logger";
import { startGenerationBackgroundPoller } from "./lib/generation/backgroundPoller";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Warn loudly if object storage isn't configured so misconfiguration is
  // obvious in logs rather than silently failing at generation-complete time.
  // Fix: call setupObjectStorage() in the Replit CodeExecution sandbox, then
  // restart this workflow to pick up the new env vars.
  if (!process.env.PRIVATE_OBJECT_DIR || !process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID) {
    logger.warn(
      "Object storage is NOT configured (PRIVATE_OBJECT_DIR / DEFAULT_OBJECT_STORAGE_BUCKET_ID missing). " +
      "Generated assets will use temporary provider URLs and may expire. " +
      "Run setupObjectStorage() in the Replit sandbox to fix.",
    );
  }

  // Runs inside this same long-lived process, independent of any browser
  // tab — see backgroundPoller.ts for why this exists.
  startGenerationBackgroundPoller(logger);
});
