import type {
  FastifyInstance,
} from "fastify";

import {
  getArtifactDownloadUrl,
  listRunArtifacts,
} from "../services/artifacts/artifacts-service.js";

import {
  artifactParamsSchema,
  parseRouteInput,
  runParamsSchema,
} from "./validation.js";

export async function artifactsRoutes(
  app: FastifyInstance,
) {
  app.get(
    "/github/repos/:owner/:repo/runs/:runId/artifacts",
    async (request, reply) => {
      const params = parseRouteInput(
        runParamsSchema,
        request.params,
        reply,
        "Invalid workflow run.",
      );

      if (!params) {
        return reply;
      }

      return listRunArtifacts(
        params.owner,
        params.repo,
        params.runId,
      );
    },
  );

  app.get(
    "/github/repos/:owner/:repo/artifacts/:artifactId/download",
    async (request, reply) => {
      const params = parseRouteInput(
        artifactParamsSchema,
        request.params,
        reply,
        "Invalid artifact.",
      );

      if (!params) {
        return reply;
      }

      const downloadUrl =
        await getArtifactDownloadUrl(
          params.owner,
          params.repo,
          params.artifactId,
        );

      return reply.redirect(
        downloadUrl,
      );
    },
  );
}
