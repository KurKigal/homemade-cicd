import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  FlutterPipelineConfig,
  ManagedPipelineConfig,
  NodePipelineConfig,
} from "@homemade-cicd/core";

import {
  generateManagedWorkflow,
} from "./managed-workflow-generator.js";
import {
  parseManagedWorkflow,
} from "./managed-workflow-parser.js";
import {
  generateFlutterWorkflow,
} from "./workflow-generator.js";

const flutterConfig: FlutterPipelineConfig = {
  branch: "release/flutter",
  trigger: {
    push: true,
    pullRequest: false,
    manual: true,
  },
  checks: {
    analyze: true,
    test: false,
  },
  android: {
    enabled: true,
    apk: true,
    aab: false,
  },
  ios: {
    enabled: false,
    unsignedBuild: false,
  },
};

const nodeConfig: NodePipelineConfig = {
  branch: "release/node",
  nodeVersion: "22",
  packageManager: "bun",
  frozenLockfile: true,
  trigger: {
    push: false,
    pullRequest: true,
    manual: true,
  },
  tasks: {
    lint: true,
    typecheck: false,
    test: true,
    build: false,
  },
};

describe("managed workflow dispatch", () => {
  it.each([
    {
      projectType: "flutter",
      config: flutterConfig,
    },
    {
      projectType: "node",
      config: nodeConfig,
    },
  ] satisfies ManagedPipelineConfig[])(
    "round-trips a $projectType pipeline through the managed dispatcher",
    (definition) => {
      const yaml = generateManagedWorkflow(definition);

      expect(yaml).toContain(
        `# homemade-project-type: ${definition.projectType}`,
      );
      expect(
        parseManagedWorkflow(yaml, "fallback"),
      ).toEqual(definition);
    },
  );

  it("parses a legacy markerless Flutter workflow", () => {
    const yaml = generateFlutterWorkflow(
      flutterConfig,
    )
      .split(/\r?\n/u)
      .slice(3)
      .join("\n");

    expect(
      parseManagedWorkflow(yaml, "fallback"),
    ).toEqual({
      projectType: "flutter",
      config: flutterConfig,
    });
  });

  it("does not claim an unrelated unmarked workflow", () => {
    expect(
      parseManagedWorkflow(
        [
          "name: External CI",
          "on:",
          "  workflow_dispatch: {}",
          "jobs:",
          "  test:",
          "    runs-on: ubuntu-latest",
          "    steps:",
          "      - run: npm test",
        ].join("\n"),
        "main",
      ),
    ).toBeNull();
  });
});
