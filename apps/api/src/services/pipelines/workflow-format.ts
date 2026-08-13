import YAML from "yaml";

import type {
  ManagedPipelineConfig,
  PipelineTrigger,
} from "@homemade-cicd/core";

export type WorkflowStep =
  Record<string, unknown>;

const MANAGED_WORKFLOW_MARKER =
  "# Managed by Homemade CI/CD";

const PROJECT_TYPE_MARKER =
  "# homemade-project-type:";

const TRIGGER_BRANCH_MARKER =
  "# homemade-trigger-branch:";

const MANAGED_WORKFLOW_HEADER =
  /^# Managed by Homemade CI\/CD\r?\n# homemade-project-type: (flutter|node)[ \t]*(?:\r?\n|$)/u;

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
): string {
  return [
    MANAGED_WORKFLOW_MARKER,
    `${PROJECT_TYPE_MARKER} ${projectType}`,
    `${TRIGGER_BRANCH_MARKER} ${JSON.stringify(triggerBranch)}`,
    YAML.stringify(workflow, {
      lineWidth: 0,
    }),
  ].join("\n");
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
    projectType === "node"
  ) {
    return projectType;
  }

  return null;
}
