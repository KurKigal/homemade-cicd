import {
  flutterPipelineSchema,
  type FlutterPipelineConfig,
  type IosSignedIpaConfig,
} from "@homemade-cicd/core";

import {
  readFlutterSigningMetadata,
  readManagedTriggerBranch,
} from "./workflow-format.js";
import {
  asRecord,
  containsCommand,
  firstBranch,
  parseWorkflowRoot,
  readCommands,
} from "./workflow-parser-utils.js";

function readStepEnvironmentValue(
  job: unknown,
  stepName: string,
  key: string,
): string | null {
  const steps = asRecord(job)?.steps;

  if (!Array.isArray(steps)) {
    return null;
  }

  for (const step of steps) {
    const stepRecord = asRecord(step);

    if (stepRecord?.name !== stepName) {
      continue;
    }

    const value =
      asRecord(stepRecord.env)?.[key];

    return typeof value === "string"
      ? value
      : null;
  }

  return null;
}

function inferIosSignedIpa(
  signedJob: unknown,
  commands: readonly string[],
): IosSignedIpaConfig | undefined {
  if (signedJob === undefined) {
    return undefined;
  }

  const teamId =
    readStepEnvironmentValue(
      signedJob,
      "Prepare iOS signing material",
      "EXPECTED_TEAM_ID",
    ) ?? "";

  const bundleId =
    readStepEnvironmentValue(
      signedJob,
      "Prepare iOS signing material",
      "EXPECTED_BUNDLE_ID",
    ) ?? "";

  const exportMethod = commands.some((command) =>
    command.includes(
      "--export-method development",
    ),
  )
    ? "development"
    : commands.some((command) =>
          command.includes(
            "--export-method ad-hoc",
          ),
        )
      ? "ad-hoc"
      : "app-store";

  return {
    enabled: true,
    teamId,
    bundleId,
    exportMethod,
  };
}

export function parseFlutterWorkflow(
  yaml: string,
  fallbackBranch: string,
): FlutterPipelineConfig {
  const root = parseWorkflowRoot(yaml);

  const triggers = asRecord(root.on) ?? {};
  const jobs = asRecord(root.jobs) ?? {};

  const quality = jobs.quality;
  const android = jobs.android;
  const signedAndroid = jobs.android_signed;
  const ios = jobs.ios;
  const signedIos = jobs.ios_signed;

  const qualityCommands = readCommands(quality);
  const androidCommands = [
    ...readCommands(android),
    ...readCommands(signedAndroid),
  ];
  const iosCommands = [
    ...readCommands(ios),
    ...readCommands(signedIos),
  ];

  const signingMetadata =
    readFlutterSigningMetadata(yaml);

  const inferredIosSigning =
    inferIosSignedIpa(
      signedIos,
      iosCommands,
    );

  const androidSigning =
    signedAndroid !== undefined
      ? { enabled: true as const }
      : signingMetadata?.android === undefined
        ? undefined
        : { enabled: false as const };

  const iosSigning =
    inferredIosSigning ??
    (signingMetadata?.ios === undefined
      ? undefined
      : {
          ...signingMetadata.ios,
          enabled: false as const,
        });

  const branch =
    firstBranch(triggers.push) ??
    firstBranch(triggers.pull_request) ??
    readManagedTriggerBranch(yaml) ??
    fallbackBranch;

  const config = {
    branch,

    trigger: {
      push: "push" in triggers,
      pullRequest: "pull_request" in triggers,
      manual: "workflow_dispatch" in triggers,
    },

    checks: {
      analyze: containsCommand(
        qualityCommands,
        "flutter analyze",
      ),
      test: containsCommand(
        qualityCommands,
        "flutter test",
      ),
    },

    android: {
      enabled:
        android !== undefined ||
        signedAndroid !== undefined,
      apk: containsCommand(
        androidCommands,
        "flutter build apk --release",
      ),
      aab: containsCommand(
        androidCommands,
        "flutter build appbundle --release",
      ),
      ...(androidSigning === undefined
        ? {}
        : { signing: androidSigning }),
    },

    ios: {
      enabled:
        ios !== undefined ||
        signedIos !== undefined,
      unsignedBuild: containsCommand(
        iosCommands,
        "flutter build ios --release --no-codesign",
      ),
      ...(iosSigning === undefined
        ? {}
        : { signedIpa: iosSigning }),
    },
  };

  return flutterPipelineSchema.parse(config);
}
