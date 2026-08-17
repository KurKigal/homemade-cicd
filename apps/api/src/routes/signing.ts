import type {
  FastifyInstance,
  FastifyReply,
} from "fastify";

import {
  androidSigningCredentialsRequestSchema,
  iosSigningCredentialsRequestSchema,
} from "@homemade-cicd/core";

import {
  deleteAndroidSigningCredentials,
  deleteIosSigningCredentials,
  getRepositorySigningStatus,
  saveAndroidSigningCredentials,
  saveIosSigningCredentials,
  SigningServiceError,
} from "../services/signing/signing-service.js";
import {
  parseRouteInput,
  repositoryParamsSchema,
} from "./validation.js";

const SENSITIVE_ROUTE_OPTIONS = {
  logLevel: "silent",
} as const;

function sendSigningError(
  reply: FastifyReply,
  error: unknown,
) {
  if (error instanceof SigningServiceError) {
    return reply.status(error.statusCode).send({
      error: error.message,
      ...(error.partialUpdate
        ? {
            partialUpdate: true,
            updatedSecrets: error.updatedSecrets,
          }
        : {}),
      ...(error.mutationCompleted
        ? {
            mutationCompleted: true,
            updatedSecrets: error.updatedSecrets,
          }
        : {}),
      ...(error.signingStatus
        ? { signingStatus: error.signingStatus }
        : {}),
    });
  }

  return reply.status(502).send({
    error: "Signing operation failed. Try again without changing the credential files.",
  });
}

export async function signingRoutes(
  app: FastifyInstance,
) {
  app.get(
    "/github/repos/:owner/:repo/signing",
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
        return await getRepositorySigningStatus(
          params.owner,
          params.repo,
        );
      } catch (error) {
        return sendSigningError(reply, error);
      }
    },
  );

  app.put(
    "/github/repos/:owner/:repo/signing/android",
    SENSITIVE_ROUTE_OPTIONS,
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

      const credentials = parseRouteInput(
        androidSigningCredentialsRequestSchema,
        request.body,
        reply,
        "Invalid Android signing credentials. Check required fields, base64 encoding, and GitHub's 48 KB secret limit.",
      );

      if (!credentials) {
        return reply;
      }

      try {
        return await saveAndroidSigningCredentials(
          params.owner,
          params.repo,
          credentials,
        );
      } catch (error) {
        return sendSigningError(reply, error);
      }
    },
  );

  app.delete(
    "/github/repos/:owner/:repo/signing/android",
    SENSITIVE_ROUTE_OPTIONS,
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
        return await deleteAndroidSigningCredentials(
          params.owner,
          params.repo,
        );
      } catch (error) {
        return sendSigningError(reply, error);
      }
    },
  );

  app.put(
    "/github/repos/:owner/:repo/signing/ios",
    SENSITIVE_ROUTE_OPTIONS,
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

      const credentials = parseRouteInput(
        iosSigningCredentialsRequestSchema,
        request.body,
        reply,
        "Invalid iOS signing credentials. Check required fields, base64 encoding, and GitHub's 48 KB secret limit.",
      );

      if (!credentials) {
        return reply;
      }

      try {
        return await saveIosSigningCredentials(
          params.owner,
          params.repo,
          credentials,
        );
      } catch (error) {
        return sendSigningError(reply, error);
      }
    },
  );

  app.delete(
    "/github/repos/:owner/:repo/signing/ios",
    SENSITIVE_ROUTE_OPTIONS,
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
        return await deleteIosSigningCredentials(
          params.owner,
          params.repo,
        );
      } catch (error) {
        return sendSigningError(reply, error);
      }
    },
  );
}
