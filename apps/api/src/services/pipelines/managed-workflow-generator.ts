import type {
  ManagedPipelineConfig,
} from "@homemade-cicd/core";

import {
  generateNodeWorkflow,
} from "./node-workflow-generator.js";
import {
  generatePythonWorkflow,
} from "./python-workflow-generator.js";
import {
  generateFlutterWorkflow,
} from "./workflow-generator.js";

export function generateManagedWorkflow(
  definition: ManagedPipelineConfig,
): string {
  switch (definition.projectType) {
    case "flutter":
      return generateFlutterWorkflow(
        definition.config,
      );

    case "node":
      return generateNodeWorkflow(
        definition.config,
      );

    case "python":
      return generatePythonWorkflow(
        definition.config,
      );
  }
}
