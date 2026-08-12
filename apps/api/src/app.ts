import cors from "@fastify/cors";
import Fastify from "fastify";

import { artifactsRoutes } from "./routes/artifacts.js";
import { githubRoutes } from "./routes/github.js";
import { pipelineRoutes } from "./routes/pipelines.js";
import { runsRoutes } from "./routes/runs.js";

const API_PREFIX = "/api";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: "http://localhost:5173",
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "homemade-cicd-api",
  }));

  await app.register(githubRoutes, { prefix: API_PREFIX });
  await app.register(runsRoutes, { prefix: API_PREFIX });
  await app.register(artifactsRoutes, { prefix: API_PREFIX });
  await app.register(pipelineRoutes, { prefix: API_PREFIX });

  return app;
}
