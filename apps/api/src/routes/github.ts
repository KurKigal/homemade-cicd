import type {
  FastifyInstance,
} from "fastify";

import { z } from "zod";

import {
  getAuthenticatedGitHubUser,
  listGitHubRepositories,
} from "../services/github/github-service.js";

import {
  inspectProject,
} from "../services/project-analysis-service.js";

const repositoryParamsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

export async function githubRoutes(
  app: FastifyInstance,
) {
  app.get(
    "/github/me",
    async () => {
      return getAuthenticatedGitHubUser();
    },
  );

  app.get(
    "/github/repos",
    async () => {
      return listGitHubRepositories();
    },
  );

  app.get(
    "/github/repos/:owner/:repo/inspect",
    async (request, reply) => {
      const result =
        repositoryParamsSchema.safeParse(
          request.params,
        );

      if (!result.success) {
        return reply.status(400).send({
          error: "Invalid repository.",
        });
      }

      const { owner, repo } =
        result.data;

      const analysis =
        await inspectProject(
          owner,
          repo,
        );

      return {
        repository: {
          owner,
          name: repo,
        },

        analysis,
      };
    },
  );
}