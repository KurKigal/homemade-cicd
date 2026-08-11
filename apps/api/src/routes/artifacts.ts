import type {
  FastifyInstance,
} from "fastify";

import {
  z,
} from "zod";

import {
  getArtifactDownloadUrl,
  listRunArtifacts,
} from "../services/artifacts/artifacts-service.js";

const runParamsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),

  runId: z.coerce
    .number()
    .int()
    .positive(),
});

const artifactParamsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),

  artifactId: z.coerce
    .number()
    .int()
    .positive(),
});

export async function artifactsRoutes(
  app: FastifyInstance,
) {
  app.get(
    "/github/repos/:owner/:repo/runs/:runId/artifacts",
    async (request, reply) => {
      const params =
        runParamsSchema.safeParse(
          request.params,
        );

      if (!params.success) {
        return reply
          .status(400)
          .send({
            error:
              "Invalid workflow run.",
          });
      }

      return listRunArtifacts(
        params.data.owner,
        params.data.repo,
        params.data.runId,
      );
    },
  );

  app.get(
    "/github/repos/:owner/:repo/artifacts/:artifactId/download",
    async (request, reply) => {
      const params =
        artifactParamsSchema.safeParse(
          request.params,
        );

      if (!params.success) {
        return reply
          .status(400)
          .send({
            error:
              "Invalid artifact.",
          });
      }

      const downloadUrl =
        await getArtifactDownloadUrl(
          params.data.owner,
          params.data.repo,
          params.data.artifactId,
        );

      return reply.redirect(
        downloadUrl,
      );
    },
  );
}