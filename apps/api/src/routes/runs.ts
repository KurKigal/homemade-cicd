import type {
  FastifyInstance,
} from "fastify";

import { z } from "zod";

import {
  cancelRepositoryWorkflow,
  dispatchRepositoryWorkflow,
  getRepositoryRun,
  listRepositoryRunJobs,
  listRepositoryRuns,
  rerunFailedRepositoryJobs,
  rerunRepositoryWorkflow,
} from "../services/runs/runs-service.js";

const workflowDispatchSchema = z.object({
  ref: z.string().min(1),
});

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

  app.post(
    "/github/repos/:owner/:repo/runs/dispatch",
    async (request, reply) => {
      const params =
        repositoryParamsSchema.safeParse(
          request.params,
        );

      const body =
        workflowDispatchSchema.safeParse(
          request.body,
        );

      if (!params.success) {
        return reply.status(400).send({
          error: "Invalid repository.",
        });
      }

      if (!body.success) {
        return reply.status(400).send({
          error: "Invalid workflow ref.",
        });
      }

      return dispatchRepositoryWorkflow(
        params.data.owner,
        params.data.repo,
        body.data.ref,
      );
    },
  );

  app.post(
    "/github/repos/:owner/:repo/runs/:runId/rerun",
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

      return rerunRepositoryWorkflow(
        params.data.owner,
        params.data.repo,
        params.data.runId,
      );
    },
  );

  app.post(
    "/github/repos/:owner/:repo/runs/:runId/rerun-failed",
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

      return rerunFailedRepositoryJobs(
        params.data.owner,
        params.data.repo,
        params.data.runId,
      );
    },
  );

  app.post(
    "/github/repos/:owner/:repo/runs/:runId/cancel",
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

      return cancelRepositoryWorkflow(
        params.data.owner,
        params.data.repo,
        params.data.runId,
      );
    },
  );
}