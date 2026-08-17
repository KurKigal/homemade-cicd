import YAML from "yaml";
import { z } from "zod";

import type {
  FlutterPipelineConfig,
  ManagedPipelineConfig,
  PipelineTrigger,
} from "@homemade-cicd/core";
import {
  androidSigningConfigSchema,
  iosSignedIpaConfigSchema,
} from "@homemade-cicd/core";

export type WorkflowStep =
  Record<string, unknown>;

const MANAGED_WORKFLOW_MARKER =
  "# Managed by Homemade CI/CD";

const PROJECT_TYPE_MARKER =
  "# homemade-project-type:";

const TRIGGER_BRANCH_MARKER =
  "# homemade-trigger-branch:";

const FLUTTER_SIGNING_MARKER =
  "# homemade-flutter-signing:";

const flutterSigningMetadataSchema = z.object({
  android:
    androidSigningConfigSchema.optional(),
  ios: iosSignedIpaConfigSchema.optional(),
}).strict();

export type FlutterSigningMetadata =
  z.infer<typeof flutterSigningMetadataSchema>;

const MANAGED_WORKFLOW_HEADER =
  /^# Managed by Homemade CI\/CD\r?\n# homemade-project-type: (flutter|node|python)[ \t]*(?:\r?\n|$)/u;

const EXPLICIT_PROJECT_TYPE_HEADER =
  /^# Managed by Homemade CI\/CD\r?\n# homemade-project-type:[^\r\n]*(?:\r?\n|$)/u;

export function createWorkflowTriggers(
  branch: string,
  trigger: PipelineTrigger,
): Record<string, unknown> {
  const triggers: Record<string, unknown> = {};

  if (trigger.manual) {
    triggers.workflow_dispatch = {};
  }

  if (trigger.push) {
    triggers.push = {
      branches: [branch],
    };
  }

  if (trigger.pullRequest) {
    triggers.pull_request = {
      branches: [branch],
    };
  }

  if (Object.keys(triggers).length === 0) {
    triggers.workflow_dispatch = {};
  }

  return triggers;
}

export function formatManagedWorkflow(
  projectType: ManagedPipelineConfig["projectType"],
  workflow: Record<string, unknown>,
  triggerBranch: string,
  additionalMarkers: readonly string[] = [],
): string {
  return [
    MANAGED_WORKFLOW_MARKER,
    `${PROJECT_TYPE_MARKER} ${projectType}`,
    `${TRIGGER_BRANCH_MARKER} ${JSON.stringify(triggerBranch)}`,
    ...additionalMarkers,
    YAML.stringify(workflow, {
      lineWidth: 0,
    }),
  ].join("\n");
}

export function createFlutterSigningMarker(
  config: FlutterPipelineConfig,
): string | null {
  const metadata: FlutterSigningMetadata = {
    ...(config.android.signing === undefined
      ? {}
      : { android: config.android.signing }),
    ...(config.ios.signedIpa === undefined
      ? {}
      : { ios: config.ios.signedIpa }),
  };

  if (Object.keys(metadata).length === 0) {
    return null;
  }

  return `${FLUTTER_SIGNING_MARKER} ${JSON.stringify(metadata)}`;
}

export function readFlutterSigningMetadata(
  yaml: string,
): FlutterSigningMetadata | null {
  if (readManagedProjectType(yaml) !== "flutter") {
    return null;
  }

  const marker = yaml.split(/\r?\n/u)[3];

  if (
    !marker?.startsWith(
      `${FLUTTER_SIGNING_MARKER} `,
    )
  ) {
    return null;
  }

  try {
    return flutterSigningMetadataSchema.parse(
      JSON.parse(
        marker.slice(
          FLUTTER_SIGNING_MARKER.length + 1,
        ),
      ) as unknown,
    );
  } catch {
    return null;
  }
}

export function readManagedTriggerBranch(
  yaml: string,
): string | null {
  if (!MANAGED_WORKFLOW_HEADER.test(yaml)) {
    return null;
  }

  const lines = yaml.split(/\r?\n/u);
  const marker = lines[2];

  if (!marker?.startsWith(`${TRIGGER_BRANCH_MARKER} `)) {
    return null;
  }

  try {
    const branch = JSON.parse(
      marker.slice(TRIGGER_BRANCH_MARKER.length + 1),
    ) as unknown;

    return typeof branch === "string" && branch.trim()
      ? branch
      : null;
  } catch {
    return null;
  }
}

export function readManagedProjectType(
  yaml: string,
): ManagedPipelineConfig["projectType"] | null {
  const header = MANAGED_WORKFLOW_HEADER.exec(yaml);

  if (!header) {
    return null;
  }

  const projectType = header[1];

  if (
    projectType === "flutter" ||
    projectType === "node" ||
    projectType === "python"
  ) {
    return projectType;
  }

  return null;
}

export function hasExplicitProjectTypeMarker(
  yaml: string,
): boolean {
  return EXPLICIT_PROJECT_TYPE_HEADER.test(yaml);
}
