import {
  describe,
  expect,
  it,
} from "vitest";

import YAML from "yaml";

import type {
  FlutterPipelineConfig,
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

function generateWorkflowObject(
  config: FlutterPipelineConfig,
): Record<string, any> {
  const yaml =
    generateFlutterWorkflow(config);

  return YAML.parse(yaml) as Record<
    string,
    any
  >;
}

describe("generateFlutterWorkflow", () => {
  it("generates the expected default Flutter workflow jobs", () => {
    const workflow =
      generateWorkflowObject(
        createConfig(),
      );

    expect(workflow.name).toBe(
      "Homemade CI/CD",
    );

    expect(workflow.jobs.quality).toBeDefined();
    expect(workflow.jobs.android).toBeDefined();
    expect(workflow.jobs.ios).toBeDefined();
  });

  it("generates push, pull request and manual triggers", () => {
    const workflow =
      generateWorkflowObject(
        createConfig(),
      );

    expect(
      workflow.on.push.branches,
    ).toEqual(["main"]);

    expect(
      workflow.on.pull_request.branches,
    ).toEqual(["main"]);

    expect(
      workflow.on.workflow_dispatch,
    ).toEqual({});
  });

  it("includes analyze and test commands when quality checks are enabled", () => {
    const workflow =
      generateWorkflowObject(
        createConfig(),
      );

    const qualitySteps:
      Array<Record<string, unknown>> =
        workflow.jobs.quality.steps;

    const commands = qualitySteps
      .map((step) => step.run)
      .filter(Boolean);

    expect(commands).toContain(
      "flutter pub get",
    );

    expect(commands).toContain(
      "flutter analyze",
    );

    expect(commands).toContain(
      "flutter test",
    );
  });

  it("removes disabled quality commands", () => {
    const workflow =
      generateWorkflowObject(
        createConfig({
          checks: {
            analyze: false,
            test: true,
          },
        }),
      );

    const commands =
      workflow.jobs.quality.steps
        .map(
          (
            step: Record<string, unknown>,
          ) => step.run,
        )
        .filter(Boolean);

    expect(commands).not.toContain(
      "flutter analyze",
    );

    expect(commands).toContain(
      "flutter test",
    );
  });

  it("makes Android depend on quality checks when quality is enabled", () => {
    const workflow =
      generateWorkflowObject(
        createConfig(),
      );

    expect(
      workflow.jobs.android.needs,
    ).toBe("quality");

    expect(
      workflow.jobs.ios.needs,
    ).toBe("quality");
  });

  it("creates APK and AAB build steps", () => {
    const workflow =
      generateWorkflowObject(
        createConfig({
          ios: {
            enabled: false,
            unsignedBuild: false,
          },
        }),
      );

    const androidSteps =
      workflow.jobs.android.steps;

    const commands = androidSteps
      .map(
        (
          step: Record<string, unknown>,
        ) => step.run,
      )
      .filter(Boolean);

    expect(commands).toContain(
      "flutter build apk --release",
    );

    expect(commands).toContain(
      "flutter build appbundle --release",
    );
  });

  it("does not create an Android job when Android is disabled", () => {
    const workflow =
      generateWorkflowObject(
        createConfig({
          android: {
            enabled: false,
            apk: false,
            aab: false,
          },
        }),
      );

    expect(
      workflow.jobs.android,
    ).toBeUndefined();

    expect(
      workflow.jobs.ios,
    ).toBeDefined();
  });

  it("creates iOS build on a macOS runner", () => {
    const workflow =
      generateWorkflowObject(
        createConfig(),
      );

    expect(
      workflow.jobs.ios["runs-on"],
    ).toBe("macos-latest");

    const commands =
      workflow.jobs.ios.steps
        .map(
          (
            step: Record<string, unknown>,
          ) => step.run,
        )
        .filter(Boolean);

    expect(commands).toContain(
      "flutter build ios --release --no-codesign",
    );
  });

  it("does not create an iOS job when iOS is disabled", () => {
    const workflow =
      generateWorkflowObject(
        createConfig({
          ios: {
            enabled: false,
            unsignedBuild: false,
          },
        }),
      );

    expect(
      workflow.jobs.ios,
    ).toBeUndefined();
  });

  it("falls back to manual trigger when no trigger is selected", () => {
    const workflow =
      generateWorkflowObject(
        createConfig({
          trigger: {
            push: false,
            pullRequest: false,
            manual: false,
          },
        }),
      );

    expect(
      workflow.on.workflow_dispatch,
    ).toEqual({});

    expect(
      workflow.on.push,
    ).toBeUndefined();

    expect(
      workflow.on.pull_request,
    ).toBeUndefined();
  });

  it("throws when no checks or build jobs are enabled", () => {
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
});