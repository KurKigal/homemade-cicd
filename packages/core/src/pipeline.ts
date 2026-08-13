import { z } from "zod";

import { packageManagerSchema } from "./project.js";

export const HOMEMADE_WORKFLOW_FILE =
  "homemade-ci.yml";

export const HOMEMADE_WORKFLOW_PATH =
  `.github/workflows/${HOMEMADE_WORKFLOW_FILE}`;

export const pipelineTriggerSchema = z.object({
  push: z.boolean(),
  pullRequest: z.boolean(),
  manual: z.boolean(),
});

export type PipelineTrigger =
  z.infer<typeof pipelineTriggerSchema>;

export const flutterPipelineSchema = z.object({
  branch: z.string().min(1),

  trigger: pipelineTriggerSchema,

  checks: z.object({
    analyze: z.boolean(),
    test: z.boolean(),
  }),

  android: z.object({
    enabled: z.boolean(),
    apk: z.boolean(),
    aab: z.boolean(),
  }),

  ios: z.object({
    enabled: z.boolean(),
    unsignedBuild: z.boolean(),
  }),
});

export type FlutterPipelineConfig =
  z.infer<typeof flutterPipelineSchema>;

export const nodePipelineSchema = z.object({
  branch: z.string().trim().min(1),
  nodeVersion: z.string().trim().min(1),
  packageManager: packageManagerSchema,
  frozenLockfile: z.boolean(),

  trigger: pipelineTriggerSchema,

  tasks: z.object({
    lint: z.boolean(),
    typecheck: z.boolean(),
    test: z.boolean(),
    build: z.boolean(),
  }),
});

export type NodePipelineConfig =
  z.infer<typeof nodePipelineSchema>;

export const managedPipelineSchema =
  z.discriminatedUnion("projectType", [
    z.object({
      projectType: z.literal("flutter"),
      config: flutterPipelineSchema,
    }),
    z.object({
      projectType: z.literal("node"),
      config: nodePipelineSchema,
    }),
  ]);

export type ManagedPipelineConfig =
  z.infer<typeof managedPipelineSchema>;

export interface PipelinePreview {
  repository: {
    owner: string;
    repo: string;
  };

  yaml: string;
}

export interface PipelineApplyResult {
  success: boolean;

  workflow: {
    path: string;
    commitSha: string;
    commitUrl: string | null;
    created: boolean;
  };
}

export interface RepositoryWorkflow {
  id: number;

  name: string;
  path: string;
  state: string;

  htmlUrl: string;

  createdAt: string;
  updatedAt: string;

  managedByHomemade: boolean;
}

export interface RepositoryWorkflowsResponse {
  totalCount: number;
  workflows: RepositoryWorkflow[];
}

export interface PipelineDetailsResponse {
  workflow: RepositoryWorkflow;

  yaml: string | null;

  config: ManagedPipelineConfig | null;
}

export interface PipelineCommandResult {
  success: boolean;
  message: string;
}
