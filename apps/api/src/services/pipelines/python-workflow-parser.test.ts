import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  PythonPackageManager,
  PythonPipelineConfig,
} from "@homemade-cicd/core";

import {
  generatePythonWorkflow,
} from "./python-workflow-generator.js";
import {
  parsePythonWorkflow,
} from "./python-workflow-parser.js";

function createConfig(
  packageManager: PythonPackageManager,
  frozenLockfile: boolean,
): PythonPipelineConfig {
  return {
    branch: "release/python",
    pythonVersion: "3.12",
    packageManager,
    dependencySource:
      packageManager === "pipenv"
        ? "pipfile"
        : packageManager === "pip"
          ? "requirements"
          : "project",
    frozenLockfile,
    trigger: {
      push: true,
      pullRequest: false,
      manual: true,
    },
    tasks: {
      ruff: true,
      pytest: true,
      mypy: true,
      build: true,
    },
  };
}

describe("parsePythonWorkflow", () => {
  it.each([
    { packageManager: "pip", frozenLockfile: false },
    { packageManager: "uv", frozenLockfile: true },
    { packageManager: "poetry", frozenLockfile: true },
    { packageManager: "pipenv", frozenLockfile: true },
    { packageManager: "pipenv", frozenLockfile: false },
  ] as const)(
    "round-trips $packageManager",
    ({ packageManager, frozenLockfile }) => {
      const original = createConfig(
        packageManager,
        frozenLockfile,
      );

      expect(
        parsePythonWorkflow(
          generatePythonWorkflow(original),
          "main",
        ),
      ).toEqual(original);
    },
  );

  it("round-trips a manual-only pipeline without losing its branch", () => {
    const original = createConfig("uv", false);
    original.trigger = {
      push: false,
      pullRequest: false,
      manual: true,
    };

    expect(
      parsePythonWorkflow(
        generatePythonWorkflow(original),
        "repository-default",
      ),
    ).toEqual(original);
  });

  it("round-trips an install-only pipeline", () => {
    const original = createConfig("poetry", false);
    original.tasks = {
      ruff: false,
      pytest: false,
      mypy: false,
      build: false,
    };

    expect(
      parsePythonWorkflow(
        generatePythonWorkflow(original),
        "main",
      ),
    ).toEqual(original);
  });

  it.each([
    "requirements-dev",
    "requirements_dev",
    "project",
  ] as const)("round-trips pip dependency source %s", (dependencySource) => {
    const original = createConfig("pip", false);
    original.dependencySource = dependencySource;

    expect(
      parsePythonWorkflow(
        generatePythonWorkflow(original),
        "main",
      ),
    ).toEqual(original);
  });
});
