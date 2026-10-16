import type {
  FastifyInstance,
  FastifyReply,
} from "fastify";

import {
  createReleaseRequestSchema,
} from "@homemade-cicd/core";

import {
  createRepositoryRelease,
  listRepositoryReleases,
  ReleaseServiceError,
} from "../services/releases/release-service.js";
import {
  parseRouteInput,
  repositoryParamsSchema,
} from "./validation.js";

function sendReleaseError(
  reply: FastifyReply,
  error: unknown,
) {
  if (error instanceof ReleaseServiceError) {
    return reply.status(error.statusCode).send({
      error: error.message,
    });
  }

  return reply.status(502).send({
    error: "The GitHub release operation failed.",
  });
}

export async function releasesRoutes(
  app: FastifyInstance,
) {
  app.get(
    "/github/repos/:owner/:repo/releases",
    async (request, reply) => {
      const params = parseRouteInput(
        repositoryParamsSchema,
        request.params,
        reply,
        "Invalid repository.",
      );

      if (!params) {
        return reply;
      }

      try {
        return await listRepositoryReleases(
          params.owner,
          params.repo,
        );
      } catch (error) {
        return sendReleaseError(reply, error);
      }
    },
  );

  app.post(
    "/github/repos/:owner/:repo/releases",
    async (request, reply) => {
      const params = parseRouteInput(
        repositoryParamsSchema,
        request.params,
        reply,
        "Invalid repository.",
      );

      if (!params) {
        return reply;
      }

      const body = parseRouteInput(
        createReleaseRequestSchema,
        request.body,
        reply,
        "Invalid release request.",
      );

      if (!body) {
        return reply;
      }

      try {
        const result = await createRepositoryRelease(
          params.owner,
          params.repo,
          body,
        );

        return reply.status(201).send(result);
      } catch (error) {
        return sendReleaseError(reply, error);
      }
    },
  );
}
