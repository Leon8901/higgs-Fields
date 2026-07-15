import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import router from "./routes";
import billingWebhookRouter from "./routes/billing-webhook";
import { logger } from "./lib/logger";
import { isMaintenanceModeEnabled, getMaintenanceMessage } from "./lib/settings";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Must be mounted before body parsers — it proxies raw request bytes.
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));

// Razorpay webhook signature verification needs the exact raw request
// bytes, so this must be mounted with express.raw() before express.json()
// touches the body. Lives outside the /api router (which is JSON-only) but
// still under /api/billing/webhook so it matches the base-path convention.
app.use("/api/billing/webhook", express.raw({ type: "*/*" }), billingWebhookRouter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// Maintenance mode: gates every /api route *except* the ones that must stay
// reachable so the owner can always get back in and turn it off again —
// the settings read/write routes themselves, and the current-user lookup
// the frontend uses to decide whether to render the "you're the owner"
// bypass banner. Runs after clerkMiddleware (identity is already resolvable
// via getAuth) so the owner check below works without re-authenticating.
const MAINTENANCE_EXEMPT_PREFIXES = ["/api/admin", "/api/settings", "/api/me", "/api/healthz"];
app.use(async (req, res, next) => {
  if (MAINTENANCE_EXEMPT_PREFIXES.some((p) => req.path.startsWith(p))) {
    next();
    return;
  }
  if (!(await isMaintenanceModeEnabled())) {
    next();
    return;
  }

  const clerkId = getAuth(req)?.userId;
  if (clerkId) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
    if (user?.isOwner) {
      next();
      return;
    }
  }

  res.status(503).json({ error: await getMaintenanceMessage() });
});

app.use("/api", router);

export default app;
