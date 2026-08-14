import type { FastifyInstance } from "fastify";

import {
  managedPipelineSchema,
} from "@homemade-cicd/core";

import {
  deleteManagedPipeline,
  disablePipeline,
  enablePipeline,
  getPipelineDetails,
  listRepositoryPipelines,
} from "../services/pipelines/pipeline-management-service.js";
import { saveWorkflow } from "../services/pipelines/pipeline-service.js";
import { generateManagedWorkflow } from "../services/pipelines/managed-workflow-generator.js";

import {
  parseRouteInput,
  repositoryParamsSchema,
  workflowParamsSchema,
} from "./validation.js";

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
        return reply;
      }

      const definition = parseRouteInput(
        managedPipelineSchema,
        request.body,
        reply,
        "Invalid pipeline configuration.",
      );

      if (!definition) {
        return reply;
      }

      return {
        repository: params,
        yaml: generateManagedWorkflow(definition),
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
        return reply;
      }

      const definition = parseRouteInput(
        managedPipelineSchema,
        request.body,
        reply,
        "Invalid pipeline configuration.",
      );

      if (!definition) {
        return reply;
      }

      const result = await saveWorkflow({
        owner: params.owner,
        repo: params.repo,
        yaml: generateManagedWorkflow(definition),
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
        return reply;
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
        return reply;
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
        return reply;
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
        return reply;
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
        return reply;
      }

      return deleteManagedPipeline(
        params.owner,
        params.repo,
        params.workflowId,
      );
    },
  );
}
