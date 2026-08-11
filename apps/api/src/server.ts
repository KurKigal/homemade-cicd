import Fastify from "fastify";
import cors from "@fastify/cors";
import { githubRoutes } from "./routes/github.js";
import { pipelineRoutes } from "./routes/pipelines.js";
import {
  runsRoutes,
} from "./routes/runs.js";

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: "http://localhost:5173",
});

app.get("/health", async () => {
  return {
    status: "ok",
    service: "homemade-cicd-api",
  };
});

await app.register(runsRoutes, {
  prefix: "/api",
});

await app.register(githubRoutes, {
  prefix: "/api",
});

await app.register(pipelineRoutes, {
  prefix: "/api",
});

try {
  await app.listen({
    port: 3001,
    host: "127.0.0.1",
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}