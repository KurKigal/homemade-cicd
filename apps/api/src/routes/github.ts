import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { github } from "../lib/github.js";
import { detectProject } from "../services/project-detector.js";

export async function githubRoutes(app: FastifyInstance) {
  app.get("/github/me", async () => {
    const { data } =
      await github.rest.users.getAuthenticated();

    return {
      login: data.login,
      name: data.name,
      avatarUrl: data.avatar_url,
      profileUrl: data.html_url,
    };
  });

  app.get("/github/repos", async () => {
    const repositories = await github.paginate(
      github.rest.repos.listForAuthenticatedUser,
      {
        visibility: "all",
        affiliation:
          "owner,collaborator,organization_member",
        sort: "updated",
        direction: "desc",
        per_page: 100,
      },
    );

    return repositories.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      description: repo.description,
      language: repo.language,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
      url: repo.html_url,
      owner: {
        login: repo.owner.login,
        avatarUrl: repo.owner.avatar_url,
      },
    }));
  });

  app.get(
    "/github/repos/:owner/:repo/inspect",
    async (request, reply) => {
      const paramsSchema = z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
      });

      const result = paramsSchema.safeParse(
        request.params,
      );

      if (!result.success) {
        return reply.status(400).send({
          error: "Invalid repository.",
        });
      }

      const { owner, repo } = result.data;

      const analysis = await detectProject(
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