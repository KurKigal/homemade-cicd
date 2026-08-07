import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  flutterPipelineSchema,
} from "../services/pipelines/pipeline-schema.js";

import {
  generateFlutterWorkflow,
} from "../services/pipelines/workflow-generator.js";

import {
  saveWorkflow,
} from "../services/pipelines/pipeline-service.js";

const repositoryParamsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

export async function pipelineRoutes(
  app: FastifyInstance,
) {
  app.post(
    "/github/repos/:owner/:repo/pipeline/preview",
    async (request, reply) => {
      const params =
        repositoryParamsSchema.safeParse(
          request.params,
        );

      if (!params.success) {
        return reply.status(400).send({
          error: "Invalid repository.",
        });
      }

      const config =
        flutterPipelineSchema.safeParse(
          request.body,
        );

      if (!config.success) {
        return reply.status(400).send({
          error: "Invalid pipeline configuration.",
          issues: config.error.issues,
        });
      }

      const yaml = generateFlutterWorkflow(
        config.data,
      );

      return {
        repository: params.data,
        yaml,
      };
    },
  );

  app.put(
    "/github/repos/:owner/:repo/pipeline",
    async (request, reply) => {
      const params =
        repositoryParamsSchema.safeParse(
          request.params,
        );

      if (!params.success) {
        return reply.status(400).send({
          error: "Invalid repository.",
        });
      }

      const config =
        flutterPipelineSchema.safeParse(
          request.body,
        );

      if (!config.success) {
        return reply.status(400).send({
          error: "Invalid pipeline configuration.",
          issues: config.error.issues,
        });
      }

      const yaml = generateFlutterWorkflow(
        config.data,
      );

      const result = await saveWorkflow({
        owner: params.data.owner,
        repo: params.data.repo,
        branch: config.data.branch,
        yaml,
      });

      return {
        success: true,
        workflow: result,
      };
    },
  );
}