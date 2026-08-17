import { z } from "zod";

import {
  packageManagerSchema,
  pythonDependencySourceSchema,
  pythonPackageManagerSchema,
  pythonTasksSchema,
} from "./project.js";
import {
  androidSigningConfigSchema,
  iosSignedIpaConfigSchema,
} from "./signing.js";

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
  branch: z.string().trim().min(1),

  trigger: pipelineTriggerSchema,

  checks: z.object({
    analyze: z.boolean(),
    test: z.boolean(),
  }),

  android: z.object({
    enabled: z.boolean(),
    apk: z.boolean(),
    aab: z.boolean(),
    signing:
      androidSigningConfigSchema.optional(),
  }),

  ios: z.object({
    enabled: z.boolean(),
    unsignedBuild: z.boolean(),
    signedIpa:
      iosSignedIpaConfigSchema.optional(),
  }),
}).superRefine((config, context) => {
  if (config.android.signing?.enabled) {
    if (!config.android.enabled) {
      context.addIssue({
        code: "custom",
        path: ["android", "enabled"],
        message:
          "Android builds must be enabled when Android signing is enabled.",
      });
    }

    if (!config.android.apk && !config.android.aab) {
      context.addIssue({
        code: "custom",
        path: ["android", "signing", "enabled"],
        message:
          "Android signing requires at least one APK or AAB artifact.",
      });
    }
  }

  if (!config.ios.signedIpa?.enabled) {
    return;
  }

  if (!config.ios.enabled) {
    context.addIssue({
      code: "custom",
      path: ["ios", "enabled"],
      message:
        "iOS builds must be enabled when signed IPA generation is enabled.",
    });
  }

  if (config.ios.unsignedBuild) {
    context.addIssue({
      code: "custom",
      path: ["ios", "unsignedBuild"],
      message:
        "Unsigned iOS and signed IPA builds cannot be enabled together.",
    });
  }

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

export const pythonPipelineSchema = z.object({
  branch: z.string().trim().min(1),
  pythonVersion: z.string().trim().min(1),
  packageManager: pythonPackageManagerSchema,
  dependencySource: pythonDependencySourceSchema,
  frozenLockfile: z.boolean(),

  trigger: pipelineTriggerSchema,

  tasks: pythonTasksSchema,
}).superRefine((config, context) => {
  const compatibleSource =
    config.packageManager === "pip"
      ? config.dependencySource === "requirements" ||
        config.dependencySource === "requirements-dev" ||
        config.dependencySource === "requirements_dev" ||
        config.dependencySource === "project"
      : config.packageManager === "pipenv"
        ? config.dependencySource === "pipfile"
        : config.dependencySource === "project";

  if (!compatibleSource) {
    context.addIssue({
      code: "custom",
      path: ["dependencySource"],
      message:
        "Dependency source is not compatible with the Python package manager.",
    });
  }

  if (
    config.packageManager === "pip" &&
    config.frozenLockfile
  ) {
    context.addIssue({
      code: "custom",
      path: ["frozenLockfile"],
      message:
        "pip dependency files are not treated as managed lockfiles.",
    });
  }
});

export type PythonPipelineConfig =
  z.infer<typeof pythonPipelineSchema>;

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
    z.object({
      projectType: z.literal("python"),
      config: pythonPipelineSchema,
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
