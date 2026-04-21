import { config as loadEnv } from "dotenv";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { contactRoute } from "./routes/contact.js";

loadEnv();
loadEnv({ path: ".env.local", override: true });

const start = async () => {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "no-referrer" },
    hsts: {
      maxAge: 15552000,
      includeSubDomains: true,
      preload: true,
    },
  });

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const allowedDomain = process.env.ALLOWED_DOMAIN ?? "";
  const subdomainRegex = allowedDomain
    ? new RegExp(
        `^https?://([a-z0-9-]+\\.)?${allowedDomain.replace(".", "\\.")}$`,
      )
    : null;

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);

      if (allowedOrigins.includes(origin)) return cb(null, true);

      if (subdomainRegex && subdomainRegex.test(origin)) return cb(null, true);

      cb(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    methods: ["GET", "POST", "OPTIONS"],
  });

  app.get("/health", async () => ({ ok: true }));

  await app.register(contactRoute, { prefix: "/api" });

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down.`);
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? "0.0.0.0";

  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
