import {
  flutterPipelineSchema,
  type FlutterPipelineConfig,
} from "@homemade-cicd/core";

import {
  readManagedTriggerBranch,
} from "./workflow-format.js";
import {
  asRecord,
  containsCommand,
  firstBranch,
  parseWorkflowRoot,
  readCommands,
} from "./workflow-parser-utils.js";

export function parseFlutterWorkflow(
  yaml: string,
  fallbackBranch: string,
): FlutterPipelineConfig {
  const root = parseWorkflowRoot(yaml);

  const triggers =
    asRecord(root.on) ?? {};

  const jobs =
    asRecord(root.jobs) ?? {};

  const quality =
    jobs.quality;

  const android =
    jobs.android;

  const ios =
    jobs.ios;

  const qualityCommands =
    readCommands(quality);

  const androidCommands =
    readCommands(android);

  const iosCommands =
    readCommands(ios);

  const branch =
    firstBranch(
      triggers.push,
    ) ??
    firstBranch(
      triggers.pull_request,
    ) ??
    readManagedTriggerBranch(yaml) ??
    fallbackBranch;

  const config = {
    branch,

    trigger: {
      push:
        "push" in triggers,

      pullRequest:
        "pull_request" in
        triggers,

      manual:
        "workflow_dispatch" in
        triggers,
    },

    checks: {
      analyze:
        containsCommand(
          qualityCommands,
          "flutter analyze",
        ),

      test:
        containsCommand(
          qualityCommands,
          "flutter test",
        ),
    },

    android: {
      enabled:
        android !== undefined,

      apk:
        containsCommand(
          androidCommands,
          "flutter build apk --release",
        ),

      aab:
        containsCommand(
          androidCommands,
          "flutter build appbundle --release",
        ),
    },

    ios: {
      enabled:
        ios !== undefined,

      unsignedBuild:
        containsCommand(
          iosCommands,
          "flutter build ios --release --no-codesign",
        ),
    },
  };

  return flutterPipelineSchema.parse(
    config,
  );
}
