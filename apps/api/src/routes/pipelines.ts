import type { FastifyInstance, FastifyReply } from "fastify";

import {
  flutterPipelineSchema,
  type FlutterPipelineConfig,
} from "@homemade-cicd/core";

import {
  deleteManagedPipeline,
  disablePipeline,
  enablePipeline,
  getPipelineDetails,
  listRepositoryPipelines,
} from "../services/pipelines/pipeline-management-service.js";
import { saveWorkflow } from "../services/pipelines/pipeline-service.js";
import { generateFlutterWorkflow } from "../services/pipelines/workflow-generator.js";

import {
  parseRouteInput,
  repositoryParamsSchema,
  workflowParamsSchema,
} from "./validation.js";

function parsePipelineConfig(
  input: unknown,
  reply: FastifyReply,
): FlutterPipelineConfig | undefined {
  const result = flutterPipelineSchema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  void reply.status(400).send({
    error: "Invalid pipeline configuration.",
    issues: result.error.issues,
  });
  return undefined;
}

export async function pipelineRoutes(app: FastifyInstance) {
  app.post(
    "/github/repos/:owner/:repo/pipeline/preview",
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

      const config = parsePipelineConfig(request.body, reply);

      if (!config) {
        return;
      }

      return {
        repository: params,
        yaml: generateFlutterWorkflow(config),
      };
    },
  );

  app.put(
    "/github/repos/:owner/:repo/pipeline",
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

      const config = parsePipelineConfig(request.body, reply);

      if (!config) {
        return;
      }

      const result = await saveWorkflow({
        owner: params.owner,
        repo: params.repo,
        yaml: generateFlutterWorkflow(config),
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
      const params = parseRouteInput(
        repositoryParamsSchema,
        request.params,
        reply,
        "Invalid repository.",
      );

      if (!params) {
        return;
      }

      return listRepositoryPipelines(params.owner, params.repo);
    },
  );

  app.get(
    "/github/repos/:owner/:repo/pipelines/:workflowId",
    async (request, reply) => {
      const params = parseRouteInput(
        workflowParamsSchema,
        request.params,
        reply,
        "Invalid pipeline.",
      );

      if (!params) {
        return;
      }

      return getPipelineDetails(
        params.owner,
        params.repo,
        params.workflowId,
      );
    },
  );

  app.post(
    "/github/repos/:owner/:repo/pipelines/:workflowId/enable",
    async (request, reply) => {
      const params = parseRouteInput(
        workflowParamsSchema,
        request.params,
        reply,
        "Invalid pipeline.",
      );

      if (!params) {
        return;
      }

      return enablePipeline(params.owner, params.repo, params.workflowId);
    },
  );

  app.post(
    "/github/repos/:owner/:repo/pipelines/:workflowId/disable",
    async (request, reply) => {
      const params = parseRouteInput(
        workflowParamsSchema,
        request.params,
        reply,
        "Invalid pipeline.",
      );

      if (!params) {
        return;
      }

      return disablePipeline(params.owner, params.repo, params.workflowId);
    },
  );

  app.delete(
    "/github/repos/:owner/:repo/pipelines/:workflowId",
    async (request, reply) => {
      const params = parseRouteInput(
        workflowParamsSchema,
        request.params,
        reply,
        "Invalid pipeline.",
      );

      if (!params) {
        return;
      }

      return deleteManagedPipeline(
        params.owner,
        params.repo,
        params.workflowId,
      );
    },
  );
}
