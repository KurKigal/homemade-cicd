import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  NodePipelineConfig,
  PackageManager,
} from "@homemade-cicd/core";

import {
  generateNodeWorkflow,
} from "./node-workflow-generator.js";
import {
  parseNodeWorkflow,
} from "./node-workflow-parser.js";

const PACKAGE_MANAGERS: PackageManager[] = [
  "pnpm",
  "npm",
  "yarn",
  "bun",
];

function createConfig(
  packageManager: PackageManager,
  frozenLockfile: boolean,
): NodePipelineConfig {
  return {
    branch: "develop",
    nodeVersion: "22",
    packageManager,
    frozenLockfile,
    trigger: {
      push: true,
      pullRequest: false,
      manual: true,
    },
    tasks: {
      lint: true,
      typecheck: false,
      test: true,
      build: false,
    },
  };
}

describe("parseNodeWorkflow", () => {
  it.each(
    PACKAGE_MANAGERS.flatMap((packageManager) =>
      [true, false].map((frozenLockfile) => ({
        packageManager,
        frozenLockfile,
      })),
    ),
  )(
    "round-trips $packageManager with frozenLockfile=$frozenLockfile",
    ({ packageManager, frozenLockfile }) => {
      const original = createConfig(
        packageManager,
        frozenLockfile,
      );

      expect(
        parseNodeWorkflow(
          generateNodeWorkflow(original),
          "main",
        ),
      ).toEqual(original);
    },
  );

  it("preserves the configured branch for a managed manual-only workflow", () => {
    const config = createConfig("npm", true);
    config.trigger = {
      push: false,
      pullRequest: false,
      manual: true,
    };

    expect(
      parseNodeWorkflow(
        generateNodeWorkflow(config),
        "repository-default",
      ).branch,
    ).toBe("develop");
  });

  it("round-trips an install-only pipeline when no conventional script exists", () => {
    const config = createConfig("npm", false);
    config.tasks = {
      lint: false,
      typecheck: false,
      test: false,
      build: false,
    };

    expect(
      parseNodeWorkflow(
        generateNodeWorkflow(config),
        "main",
      ),
    ).toEqual(config);
  });

  it("uses the fallback branch for a legacy manual-only workflow", () => {
    const config = createConfig("npm", true);
    config.trigger = {
      push: false,
      pullRequest: false,
      manual: true,
    };

    const legacyYaml = generateNodeWorkflow(config)
      .split(/\r?\n/u)
      .slice(3)
      .join("\n");

    expect(
      parseNodeWorkflow(
        legacyYaml,
        "repository-default",
      ).branch,
    ).toBe("repository-default");
  });
});
