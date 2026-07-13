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

  // Runs inside this same long-lived process, independent of any browser
  // tab — see backgroundPoller.ts for why this exists.
  startGenerationBackgroundPoller(logger);
});
