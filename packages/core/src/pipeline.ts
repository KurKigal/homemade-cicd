import { z } from "zod";

export const HOMEMADE_WORKFLOW_FILE =
  "homemade-ci.yml";

export const HOMEMADE_WORKFLOW_PATH =
  `.github/workflows/${HOMEMADE_WORKFLOW_FILE}`;

export const flutterPipelineSchema = z.object({
  branch: z.string().min(1),

  trigger: z.object({
    push: z.boolean(),
    pullRequest: z.boolean(),
    manual: z.boolean(),
  }),

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

  config: FlutterPipelineConfig | null;
}

export interface PipelineCommandResult {
  success: boolean;
  message: string;
}
