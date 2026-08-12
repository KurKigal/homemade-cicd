import YAML from "yaml";

import {
  flutterPipelineSchema,
  type FlutterPipelineConfig,
} from "@homemade-cicd/core";

type UnknownRecord =
  Record<string, unknown>;

function asRecord(
  value: unknown,
): UnknownRecord | null {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as UnknownRecord;
}

function asArray(
  value: unknown,
): unknown[] {
  return Array.isArray(value)
    ? value
    : [];
}

function readCommands(
  job: unknown,
): string[] {
  const jobRecord =
    asRecord(job);

  if (!jobRecord) {
    return [];
  }

  return asArray(
    jobRecord.steps,
  )
    .map((step) =>
      asRecord(step),
    )
    .filter(
      (
        step,
      ): step is UnknownRecord =>
        step !== null,
    )
    .map((step) => step.run)
    .filter(
      (
        run,
      ): run is string =>
        typeof run === "string",
    );
}

function containsCommand(
  commands: string[],
  expected: string,
): boolean {
  return commands.some(
    (command) =>
      command.trim() === expected,
  );
}

function firstBranch(
  trigger: unknown,
): string | null {
  const triggerRecord =
    asRecord(trigger);

  if (!triggerRecord) {
    return null;
  }

  const branches =
    triggerRecord.branches;

  if (typeof branches === "string") {
    return branches;
  }

  if (Array.isArray(branches)) {
    const branch =
      branches.find(
        (item) =>
          typeof item === "string",
      );

    return typeof branch === "string"
      ? branch
      : null;
  }

  return null;
}

export function parseFlutterWorkflow(
  yaml: string,
  fallbackBranch: string,
): FlutterPipelineConfig {
  const parsed =
    YAML.parse(yaml) as unknown;

  const root =
    asRecord(parsed);

  if (!root) {
    throw new Error(
      "Workflow YAML is not a valid object.",
    );
  }

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