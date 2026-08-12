import type { FastifyInstance } from "fastify";
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

import {
  parseRouteInput,
  repositoryParamsSchema,
  runParamsSchema,
} from "./validation.js";

const workflowDispatchSchema = z.object({
  ref: z.string().min(1),
});

const runsQuerySchema = z.object({
  perPage: z.coerce.number().int().min(1).max(100).default(30),
});

export async function runsRoutes(app: FastifyInstance) {
  app.get(
    "/github/repos/:owner/:repo/runs",
    async (request, reply) => {
      const params = parseRouteInput(
        repositoryParamsSchema,
        request.params,
        reply,
        "Invalid repository.",
      );

      if (!params) {
        return;
      }

      const query = parseRouteInput(
        runsQuerySchema,
        request.query,
        reply,
        "Invalid query parameters.",
      );

      if (!query) {
        return;
      }

      return listRepositoryRuns(
        params.owner,
        params.repo,
        query.perPage,
      );
    },
  );

  app.get(
    "/github/repos/:owner/:repo/runs/:runId",
    async (request, reply) => {
      const params = parseRouteInput(
        runParamsSchema,
        request.params,
        reply,
        "Invalid workflow run.",
      );

      if (!params) {
        return;
      }

      const run = await getRepositoryRun(
        params.owner,
        params.repo,
        params.runId,
      );

      return { run };
    },
  );

  app.get(
    "/github/repos/:owner/:repo/runs/:runId/jobs",
    async (request, reply) => {
      const params = parseRouteInput(
        runParamsSchema,
        request.params,
        reply,
        "Invalid workflow run.",
      );

      if (!params) {
        return;
      }

      return listRepositoryRunJobs(
        params.owner,
        params.repo,
        params.runId,
      );
    },
  );

  app.post(
    "/github/repos/:owner/:repo/runs/dispatch",
    async (request, reply) => {
      const params = parseRouteInput(
        repositoryParamsSchema,
        request.params,
        reply,
        "Invalid repository.",
      );

      if (!params) {
        return;
      }

      const body = parseRouteInput(
        workflowDispatchSchema,
        request.body,
        reply,
        "Invalid workflow ref.",
      );

      if (!body) {
        return;
      }

      return dispatchRepositoryWorkflow(
        params.owner,
        params.repo,
        body.ref,
      );
    },
  );

  app.post(
    "/github/repos/:owner/:repo/runs/:runId/rerun",
    async (request, reply) => {
      const params = parseRouteInput(
        runParamsSchema,
        request.params,
        reply,
        "Invalid workflow run.",
      );

      if (!params) {
        return;
      }

      return rerunRepositoryWorkflow(
        params.owner,
        params.repo,
        params.runId,
      );
    },
  );

  app.post(
    "/github/repos/:owner/:repo/runs/:runId/rerun-failed",
    async (request, reply) => {
      const params = parseRouteInput(
        runParamsSchema,
        request.params,
        reply,
        "Invalid workflow run.",
      );

      if (!params) {
        return;
      }

      return rerunFailedRepositoryJobs(
        params.owner,
        params.repo,
        params.runId,
      );
    },
  );

  app.post(
    "/github/repos/:owner/:repo/runs/:runId/cancel",
    async (request, reply) => {
      const params = parseRouteInput(
        runParamsSchema,
        request.params,
        reply,
        "Invalid workflow run.",
      );

      if (!params) {
        return;
      }

      return cancelRepositoryWorkflow(
        params.owner,
        params.repo,
        params.runId,
      );
    },
  );
}
