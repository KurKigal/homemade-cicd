import {
  describe,
  expect,
  it,
} from "vitest";

import YAML from "yaml";

import {
  SIGNING_SECRET_NAMES,
  type FlutterPipelineConfig,
  type IosExportMethod,
} from "@homemade-cicd/core";

import {
  generateFlutterWorkflow,
} from "./workflow-generator.js";

function createConfig(
  overrides: Partial<FlutterPipelineConfig> = {},
): FlutterPipelineConfig {
  const base: FlutterPipelineConfig = {
    branch: "main",
    trigger: {
      push: true,
      pullRequest: true,
      manual: true,
    },
    checks: {
      analyze: true,
      test: true,
    },
    android: {
      enabled: true,
      apk: true,
      aab: true,
    },
    ios: {
      enabled: true,
      unsignedBuild: true,
    },
  };

  return {
    ...base,
    ...overrides,
    trigger: {
      ...base.trigger,
      ...overrides.trigger,
    },
    checks: {
      ...base.checks,
      ...overrides.checks,
    },
    android: {
      ...base.android,
      ...overrides.android,
    },
    ios: {
      ...base.ios,
      ...overrides.ios,
    },
  };
}

function asRecord(
  value: unknown,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error("Expected an object.");
  }

  return value as Record<string, unknown>;
}

function generateWorkflowObject(
  config: FlutterPipelineConfig,
): Record<string, unknown> {
  const parsed: unknown = YAML.parse(
    generateFlutterWorkflow(config),
  );

  return asRecord(parsed);
}

function readJobs(
  workflow: Record<string, unknown>,
): Record<string, unknown> {
  return asRecord(workflow.jobs);
}

function readJob(
  workflow: Record<string, unknown>,
  jobName: string,
): Record<string, unknown> {
  return asRecord(readJobs(workflow)[jobName]);
}

function readSteps(
  job: Record<string, unknown>,
): Array<Record<string, unknown>> {
  if (!Array.isArray(job.steps)) {
    throw new Error("Expected workflow steps.");
  }

  return job.steps.map(asRecord);
}

function readCommands(
  job: Record<string, unknown>,
): string[] {
  return readSteps(job)
    .map((step) => step.run)
    .filter(
      (command): command is string =>
        typeof command === "string",
    );
}

function findStep(
  job: Record<string, unknown>,
  name: string,
): Record<string, unknown> {
  const step = readSteps(job).find(
    (candidate) => candidate.name === name,
  );

  if (!step) {
    throw new Error(`Missing step: ${name}`);
  }

  return step;
}

function artifactNames(
  job: Record<string, unknown>,
): string[] {
  return readSteps(job)
    .filter(
      (step) =>
        step.uses ===
        "actions/upload-artifact@v4",
    )
    .map((step) => asRecord(step.with).name)
    .filter(
      (name): name is string =>
        typeof name === "string",
    );
}

function createSignedIosConfig(
  exportMethod: IosExportMethod = "app-store",
): FlutterPipelineConfig {
  return createConfig({
    android: {
      enabled: false,
      apk: false,
      aab: false,
    },
    ios: {
      enabled: true,
      unsignedBuild: false,
      signedIpa: {
        enabled: true,
        teamId: "ABCDE12345",
        bundleId: "com.example.application",
        exportMethod,
      },
    },
  });
}

describe("generateFlutterWorkflow", () => {
  it("generates the existing unsigned Flutter jobs", () => {
    const workflow = generateWorkflowObject(
      createConfig(),
    );
    const jobs = readJobs(workflow);

    expect(workflow.name).toBe("Homemade CI/CD");
    expect(jobs.quality).toBeDefined();
    expect(jobs.android).toBeDefined();
    expect(jobs.ios).toBeDefined();
    expect(jobs.android_signed).toBeUndefined();
    expect(jobs.ios_signed).toBeUndefined();
  });

  it("generates push, pull request and manual triggers", () => {
    const workflow = generateWorkflowObject(
      createConfig(),
    );
    const triggers = asRecord(workflow.on);

    expect(
      asRecord(triggers.push).branches,
    ).toEqual(["main"]);
    expect(
      asRecord(triggers.pull_request).branches,
    ).toEqual(["main"]);
    expect(triggers.workflow_dispatch).toEqual({});
  });

  it("includes only enabled quality commands", () => {
    const workflow = generateWorkflowObject(
      createConfig({
        checks: {
          analyze: false,
          test: true,
        },
      }),
    );
    const commands = readCommands(
      readJob(workflow, "quality"),
    );

    expect(commands).toContain("flutter pub get");
    expect(commands).not.toContain(
      "flutter analyze",
    );
    expect(commands).toContain("flutter test");
  });

  it("keeps unsigned builds dependent on quality", () => {
    const workflow = generateWorkflowObject(
      createConfig(),
    );

    expect(readJob(workflow, "android").needs)
      .toBe("quality");
    expect(readJob(workflow, "ios").needs)
      .toBe("quality");
  });

  it("keeps unsigned jobs available on pull requests", () => {
    const workflow = generateWorkflowObject(
      createConfig(),
    );

    expect(readJob(workflow, "android").if)
      .toBeUndefined();
    expect(readJob(workflow, "ios").if)
      .toBeUndefined();
  });

  it("preserves unsigned Android and iOS build behavior", () => {
    const workflow = generateWorkflowObject(
      createConfig(),
    );

    expect(
      readCommands(readJob(workflow, "android")),
    ).toEqual(
      expect.arrayContaining([
        "flutter build apk --release",
        "flutter build appbundle --release",
      ]),
    );
    expect(
      readCommands(readJob(workflow, "ios")),
    ).toContain(
      "flutter build ios --release --no-codesign",
    );
    expect(
      artifactNames(readJob(workflow, "android")),
    ).toEqual(["android-apk", "android-aab"]);
    expect(
      artifactNames(readJob(workflow, "ios")),
    ).toEqual(["ios-unsigned"]);
  });

  it("omits disabled platform jobs", () => {
    const workflow = generateWorkflowObject(
      createConfig({
        android: {
          enabled: false,
          apk: false,
          aab: false,
        },
        ios: {
          enabled: false,
          unsignedBuild: false,
        },
      }),
    );
    const jobs = readJobs(workflow);

    expect(jobs.android).toBeUndefined();
    expect(jobs.android_signed).toBeUndefined();
    expect(jobs.ios).toBeUndefined();
    expect(jobs.ios_signed).toBeUndefined();
    expect(jobs.quality).toBeDefined();
  });

  it("falls back to a manual trigger", () => {
    const workflow = generateWorkflowObject(
      createConfig({
        trigger: {
          push: false,
          pullRequest: false,
          manual: false,
        },
      }),
    );
    const triggers = asRecord(workflow.on);

    expect(triggers.workflow_dispatch).toEqual({});
    expect(triggers.push).toBeUndefined();
    expect(triggers.pull_request).toBeUndefined();
  });

  it("throws when no check or build is enabled", () => {
    const config = createConfig({
      checks: {
        analyze: false,
        test: false,
      },
      android: {
        enabled: false,
        apk: false,
        aab: false,
      },
      ios: {
        enabled: false,
        unsignedBuild: false,
      },
    });

    expect(() =>
      generateFlutterWorkflow(config),
    ).toThrow(
      "Pipeline must contain at least one check or build.",
    );
  });

  it("creates a separate signed Android job with runtime credentials", () => {
    const config = createConfig({
      android: {
        enabled: true,
        apk: true,
        aab: true,
        signing: { enabled: true },
      },
      ios: {
        enabled: false,
        unsignedBuild: false,
      },
    });
    const workflow = generateWorkflowObject(config);
    const jobs = readJobs(workflow);
    const job = readJob(workflow, "android_signed");
    const prepare = findStep(
      job,
      "Prepare Android signing material",
    );
    const environment = asRecord(prepare.env);
    const commands = readCommands(job).join("\n");

    expect(jobs.android).toBeUndefined();
    expect(job["runs-on"]).toBe("ubuntu-latest");
    expect(job.needs).toBe("quality");
    expect(job.if).toBe(
      "github.event_name != 'pull_request'",
    );
    expect(environment).toEqual({
      ANDROID_KEYSTORE_BASE64:
        `\${{ secrets.${SIGNING_SECRET_NAMES.android.keystore} }}`,
      ANDROID_STORE_PASSWORD:
        `\${{ secrets.${SIGNING_SECRET_NAMES.android.storePassword} }}`,
      ANDROID_KEY_PASSWORD:
        `\${{ secrets.${SIGNING_SECRET_NAMES.android.keyPassword} }}`,
      ANDROID_KEY_ALIAS:
        `\${{ secrets.${SIGNING_SECRET_NAMES.android.keyAlias} }}`,
    });
    expect(commands).toContain(
      "base64 --decode",
    );
    expect(commands).toContain(
      "Properties properties = new Properties();",
    );
    expect(commands).toContain(
      "Path.of(\"android/key.properties\")",
    );
    expect(commands).toContain(
      "flutter build apk --release",
    );
    expect(commands).toContain(
      "flutter build appbundle --release",
    );
    expect(commands).toContain(
      "apksigner",
    );
    expect(commands).toContain(
      "jarsigner -verify",
    );
    expect(commands).toContain(
      "keytool -printcert -jarfile",
    );
    expect(commands).toContain(
      "rm -f android/key.properties",
    );
    expect(artifactNames(job)).toEqual([
      "android-apk-signed",
      "android-aab-signed",
    ]);
    expect(
      findStep(
        job,
        "Clean up Android signing material",
      ).if,
    ).toBe("${{ always() }}");
  });

  it("only produces the selected signed Android artifact", () => {
    const workflow = generateWorkflowObject(
      createConfig({
        android: {
          enabled: true,
          apk: false,
          aab: true,
          signing: { enabled: true },
        },
        ios: {
          enabled: false,
          unsignedBuild: false,
        },
      }),
    );

    expect(
      artifactNames(
        readJob(workflow, "android_signed"),
      ),
    ).toEqual(["android-aab-signed"]);
  });

  it("does not add a missing quality dependency to signing jobs", () => {
    const workflow = generateWorkflowObject(
      createConfig({
        checks: {
          analyze: false,
          test: false,
        },
        android: {
          enabled: true,
          apk: true,
          aab: false,
          signing: { enabled: true },
        },
        ios: {
          enabled: false,
          unsignedBuild: false,
        },
      }),
    );
    const jobs = readJobs(workflow);

    expect(jobs.quality).toBeUndefined();
    expect(
      readJob(workflow, "android_signed").needs,
    ).toBeUndefined();
  });

  it("creates a temporary-keychain signed IPA job", () => {
    const workflow = generateWorkflowObject(
      createSignedIosConfig(),
    );
    const jobs = readJobs(workflow);
    const job = readJob(workflow, "ios_signed");
    const prepare = findStep(
      job,
      "Prepare iOS signing material",
    );
    const environment = asRecord(prepare.env);
    const commands = readCommands(job).join("\n");

    expect(jobs.ios).toBeUndefined();
    expect(job["runs-on"]).toBe("macos-latest");
    expect(job.needs).toBe("quality");
    expect(job.if).toBe(
      "github.event_name != 'pull_request'",
    );
    expect(environment).toMatchObject({
      IOS_CERTIFICATE_P12_BASE64:
        `\${{ secrets.${SIGNING_SECRET_NAMES.ios.certificate} }}`,
      IOS_CERTIFICATE_PASSWORD:
        `\${{ secrets.${SIGNING_SECRET_NAMES.ios.certificatePassword} }}`,
      IOS_PROVISIONING_PROFILE_BASE64:
        `\${{ secrets.${SIGNING_SECRET_NAMES.ios.provisioningProfile} }}`,
      EXPECTED_TEAM_ID: "ABCDE12345",
      EXPECTED_BUNDLE_ID:
        "com.example.application",
    });
    expect(commands).toContain("base64 -D");
    expect(commands).toContain(
      "security create-keychain",
    );
    expect(commands).toContain("security import");
    expect(commands).toContain(
      "security set-key-partition-list",
    );
    expect(commands).toContain("security cms -D");
    expect(commands).toContain(
      "Configured Team ID does not match",
    );
    expect(commands).toContain(
      "Configured Bundle ID does not match",
    );
    expect(commands).toContain(
      "flutter build ipa --release",
    );
    expect(commands).toContain(
      "codesign --verify --deep --strict",
    );
    expect(commands).toContain(
      "security delete-keychain",
    );
    expect(commands).toContain(
      "homemade-ios-verify\" -depth -delete",
    );
    expect(artifactNames(job)).toEqual([
      "ios-ipa-signed",
    ]);
    expect(
      findStep(
        job,
        "Clean up iOS signing material",
      ).if,
    ).toBe("${{ always() }}");
  });

  it.each([
    ["app-store", "flutter build ipa --release"],
    [
      "ad-hoc",
      "flutter build ipa --release --export-method ad-hoc",
    ],
    [
      "development",
      "flutter build ipa --release --export-method development",
    ],
  ] satisfies Array<[IosExportMethod, string]>) (
    "uses the official Flutter IPA command for %s",
    (exportMethod, expectedCommand) => {
      const workflow = generateWorkflowObject(
        createSignedIosConfig(exportMethod),
      );

      expect(
        readCommands(
          readJob(workflow, "ios_signed"),
        ),
      ).toContain(expectedCommand);
    },
  );

  it("never exposes signing jobs to pull_request code", () => {
    const config = createSignedIosConfig();
    config.android = {
      enabled: true,
      apk: true,
      aab: true,
      signing: { enabled: true },
    };

    const yaml = generateFlutterWorkflow(config);
    const workflow = generateWorkflowObject(config);

    expect(
      readJob(workflow, "android_signed").if,
    ).toBe("github.event_name != 'pull_request'");
    expect(
      readJob(workflow, "ios_signed").if,
    ).toBe("github.event_name != 'pull_request'");
    expect(yaml).toContain("pull_request:");
    expect(yaml).not.toContain(
      "pull_request_target",
    );
    expect(workflow.permissions).toEqual({
      contents: "read",
    });
  });

  it("does not serialize unexpected credential plaintext", () => {
    const androidPlaintext =
      "fixture-android-password-never-serialize";
    const iosPlaintext =
      "fixture-ios-password-never-serialize";
    const base = createSignedIosConfig();
    const configWithUnexpectedCredentials = {
      ...base,
      android: {
        enabled: true,
        apk: true,
        aab: false,
        signing: { enabled: true },
        credentials: {
          storePassword: androidPlaintext,
        },
      },
      ios: {
        ...base.ios,
        credentials: {
          certificatePassword: iosPlaintext,
        },
      },
    };

    const yaml = generateFlutterWorkflow(
      configWithUnexpectedCredentials,
    );
    const signingMarker = yaml
      .split(/\r?\n/u)
      .find((line) =>
        line.startsWith(
          "# homemade-flutter-signing:",
        ),
      );

    expect(yaml).not.toContain(androidPlaintext);
    expect(yaml).not.toContain(iosPlaintext);
    expect(signingMarker).not.toContain(
      "HOMEMADE_",
    );
    expect(signingMarker).not.toContain(
      "password",
    );
  });
});
