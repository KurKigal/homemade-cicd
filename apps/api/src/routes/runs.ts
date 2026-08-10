import type {
  FastifyInstance,
} from "fastify";

import { z } from "zod";

import {
  getRepositoryRun,
  listRepositoryRunJobs,
  listRepositoryRuns,
} from "../services/runs/runs-service.js";

const repositoryParamsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

const runParamsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),

  runId: z.coerce
    .number()
    .int()
    .positive(),
});

const runsQuerySchema = z.object({
  perPage: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(30),
});

export async function runsRoutes(
  app: FastifyInstance,
) {
  app.get(
    "/github/repos/:owner/:repo/runs",
    async (request, reply) => {
      const params =
        repositoryParamsSchema.safeParse(
          request.params,
        );

      const query =
        runsQuerySchema.safeParse(
          request.query,
        );

      if (!params.success) {
        return reply.status(400).send({
          error: "Invalid repository.",
        });
      }

      if (!query.success) {
        return reply.status(400).send({
          error: "Invalid query parameters.",
        });
      }

      return listRepositoryRuns(
        params.data.owner,
        params.data.repo,
        query.data.perPage,
      );
    },
  );

  app.get(
    "/github/repos/:owner/:repo/runs/:runId",
    async (request, reply) => {
      const params =
        runParamsSchema.safeParse(
          request.params,
        );

      if (!params.success) {
        return reply.status(400).send({
          error: "Invalid workflow run.",
        });
      }

      const run =
        await getRepositoryRun(
          params.data.owner,
          params.data.repo,
          params.data.runId,
        );

      return {
        run,
      };
    },
  );

  app.get(
    "/github/repos/:owner/:repo/runs/:runId/jobs",
    async (request, reply) => {
      const params =
        runParamsSchema.safeParse(
          request.params,
        );

      if (!params.success) {
        return reply.status(400).send({
          error: "Invalid workflow run.",
        });
      }

      return listRepositoryRunJobs(
        params.data.owner,
        params.data.repo,
        params.data.runId,
      );
    },
  );
}