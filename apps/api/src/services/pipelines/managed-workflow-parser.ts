import type {
  ManagedPipelineConfig,
} from "@homemade-cicd/core";

import {
  hasExplicitProjectTypeMarker,
  readManagedProjectType,
} from "./workflow-format.js";
import {
  parseNodeWorkflow,
} from "./node-workflow-parser.js";
import {
  parsePythonWorkflow,
} from "./python-workflow-parser.js";
import {
  parseFlutterWorkflow,
} from "./workflow-parser.js";
import {
  asRecord,
  parseWorkflowRoot,
  readSteps,
} from "./workflow-parser-utils.js";

function isLegacyFlutterWorkflow(
  yaml: string,
): boolean {
  try {
    const root = parseWorkflowRoot(yaml);
    const jobs = asRecord(root.jobs) ?? {};

    return Object.values(jobs).some((job) =>
      readSteps(job).some(
        (step) =>
          step.uses === "subosito/flutter-action@v2",
      ),
    );
  } catch {
    return false;
  }
}

export function parseManagedWorkflow(
  yaml: string,
  fallbackBranch: string,
): ManagedPipelineConfig | null {
  const projectType = readManagedProjectType(yaml);

  if (projectType === "node") {
    return {
      projectType,
      config: parseNodeWorkflow(
        yaml,
        fallbackBranch,
      ),
    };
  }

  if (projectType === "python") {
    return {
      projectType,
      config: parsePythonWorkflow(
        yaml,
        fallbackBranch,
      ),
    };
  }

  if (
    projectType === "flutter" ||
    (!hasExplicitProjectTypeMarker(yaml) &&
      isLegacyFlutterWorkflow(yaml))
  ) {
    return {
      projectType: "flutter",
      config: parseFlutterWorkflow(
        yaml,
        fallbackBranch,
      ),
    };
  }

  return null;
}
