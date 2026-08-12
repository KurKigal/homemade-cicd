import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  flutterPipelineSchema,
} from "@homemade-cicd/core";

import {
  generateFlutterWorkflow,
} from "../services/pipelines/workflow-generator.js";

import {
  saveWorkflow,
} from "../services/pipelines/pipeline-service.js";

import {
  deleteManagedPipeline,
  disablePipeline,
  enablePipeline,
  getPipelineDetails,
  listRepositoryPipelines,
} from "../services/pipelines/pipeline-management-service.js";

const repositoryParamsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

const workflowParamsSchema =
  z.object({
    owner:
      z.string().min(1),

    repo:
      z.string().min(1),

    workflowId:
      z.coerce
        .number()
        .int()
        .positive(),
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
        yaml,
      });

      return {
        success: true,
        workflow: result,
      };
    },
  );

  app.get(
    "/github/repos/:owner/:repo/pipelines",
    async (request, reply) => {
      const result =
        repositoryParamsSchema.safeParse(
          request.params,
        );

      if (!result.success) {
        return reply.status(400).send({
          error:
            "Invalid repository.",
        });
      }

      return listRepositoryPipelines(
        result.data.owner,
        result.data.repo,
      );
    },
  );

  app.get(
    "/github/repos/:owner/:repo/pipelines/:workflowId",
    async (request, reply) => {
      const result =
        workflowParamsSchema.safeParse(
          request.params,
        );

      if (!result.success) {
        return reply.status(400).send({
          error:
            "Invalid pipeline.",
        });
      }

      return getPipelineDetails(
        result.data.owner,
        result.data.repo,
        result.data.workflowId,
      );
    },
  );

  app.post(
    "/github/repos/:owner/:repo/pipelines/:workflowId/enable",
    async (request, reply) => {
      const result =
        workflowParamsSchema.safeParse(
          request.params,
        );

      if (!result.success) {
        return reply.status(400).send({
          error:
            "Invalid pipeline.",
        });
      }

      return enablePipeline(
        result.data.owner,
        result.data.repo,
        result.data.workflowId,
      );
    },
  );

  app.post(
    "/github/repos/:owner/:repo/pipelines/:workflowId/disable",
    async (request, reply) => {
      const result =
        workflowParamsSchema.safeParse(
          request.params,
        );

      if (!result.success) {
        return reply.status(400).send({
          error:
            "Invalid pipeline.",
        });
      }

      return disablePipeline(
        result.data.owner,
        result.data.repo,
        result.data.workflowId,
      );
    },
  );

  app.delete(
    "/github/repos/:owner/:repo/pipelines/:workflowId",
    async (request, reply) => {
      const result =
        workflowParamsSchema.safeParse(
          request.params,
        );

      if (!result.success) {
        return reply.status(400).send({
          error:
            "Invalid pipeline.",
        });
      }

      return deleteManagedPipeline(
        result.data.owner,
        result.data.repo,
        result.data.workflowId,
      );
    },
  );

}