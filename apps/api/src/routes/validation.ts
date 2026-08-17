import type { FastifyReply } from "fastify";
import { z } from "zod";

export const repositoryParamsSchema = z.object({
  owner: z.string().trim().min(1),
  repo: z.string().trim().min(1),
});

export const runParamsSchema = repositoryParamsSchema.extend({
  runId: z.coerce.number().int().positive(),
});

export const artifactParamsSchema = repositoryParamsSchema.extend({
  artifactId: z.coerce.number().int().positive(),
});

export const workflowParamsSchema = repositoryParamsSchema.extend({
  workflowId: z.coerce.number().int().positive(),
});

export function parseRouteInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  reply: FastifyReply,
  error: string,
): T | undefined {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  void reply.status(400).send({ error });
  return undefined;
}
