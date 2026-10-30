// Must be imported before any other module so Sentry can instrument them
import { config as loadEnv } from "dotenv";
import * as Sentry from "@sentry/node";

loadEnv();
loadEnv({ path: ".env.local", override: true });

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Attach local variable values to stack frames
  includeLocalVariables: true,
});
