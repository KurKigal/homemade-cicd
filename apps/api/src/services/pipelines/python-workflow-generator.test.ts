import {
  describe,
  expect,
  it,
} from "vitest";

import YAML from "yaml";

import type {
  PythonDependencySource,
  PythonPackageManager,
  PythonPipelineConfig,
} from "@homemade-cicd/core";

import {
  generatePythonWorkflow,
} from "./python-workflow-generator.js";

interface WorkflowStep {
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, unknown>;
}

interface WorkflowObject {
  on: Record<string, unknown>;
  jobs: {
    quality: {
      "runs-on": string;
      steps: WorkflowStep[];
    };
  };
}

function createPythonConfig(
  overrides: Partial<PythonPipelineConfig> = {},
): PythonPipelineConfig {
  const base: PythonPipelineConfig = {
    branch: "main",
    pythonVersion: "3.12",
    packageManager: "uv",
    dependencySource: "project",
    frozenLockfile: true,
    trigger: {
      push: true,
      pullRequest: true,
      manual: true,
    },
    tasks: {
      ruff: true,
      pytest: true,
      mypy: true,
      build: true,
    },
  };

  return {
    ...base,
    ...overrides,
    trigger: {
      ...base.trigger,
      ...overrides.trigger,
    },
    tasks: {
      ...base.tasks,
      ...overrides.tasks,
    },
  };
}

function generateWorkflowObject(
  config: PythonPipelineConfig,
): WorkflowObject {
  return YAML.parse(
    generatePythonWorkflow(config),
  ) as WorkflowObject;
}

const INSTALL_CASES: Array<{
  packageManager: PythonPackageManager;
  dependencySource: PythonDependencySource;
  frozenLockfile: boolean;
  command: string;
}> = [
  {
    packageManager: "pip",
    dependencySource: "requirements",
    frozenLockfile: false,
    command: "python -m pip install -r requirements.txt",
  },
  {
    packageManager: "pip",
    dependencySource: "requirements-dev",
    frozenLockfile: false,
    command: "python -m pip install -r requirements-dev.txt",
  },
  {
    packageManager: "pip",
    dependencySource: "requirements_dev",
    frozenLockfile: false,
    command: "python -m pip install -r requirements_dev.txt",
  },
  {
    packageManager: "pip",
    dependencySource: "project",
    frozenLockfile: false,
    command: "python -m pip install .",
  },
  {
    packageManager: "uv",
    dependencySource: "project",
    frozenLockfile: true,
    command: "uv sync --locked",
  },
  {
    packageManager: "uv",
    dependencySource: "project",
    frozenLockfile: false,
    command: "uv sync",
  },
  {
    packageManager: "poetry",
    dependencySource: "project",
    frozenLockfile: true,
    command: "poetry sync --no-interaction",
  },
  {
    packageManager: "poetry",
    dependencySource: "project",
    frozenLockfile: false,
    command: "poetry install --no-interaction",
  },
  {
    packageManager: "pipenv",
    dependencySource: "pipfile",
    frozenLockfile: true,
    command: "pipenv sync --dev",
  },
  {
    packageManager: "pipenv",
    dependencySource: "pipfile",
    frozenLockfile: false,
    command: "pipenv install --dev",
  },
];

const TASK_COMMANDS: Record<
  PythonPackageManager,
  [string, string, string, string]
> = {
  pip: [
    "ruff check .",
    "pytest",
    "mypy .",
    "python -m build",
  ],
  uv: [
    "uv run ruff check .",
    "uv run pytest",
    "uv run mypy .",
    "uv build",
  ],
  poetry: [
    "poetry run ruff check .",
    "poetry run pytest",
    "poetry run mypy .",
    "poetry build",
  ],
  pipenv: [
    "pipenv run ruff check .",
    "pipenv run pytest",
    "pipenv run mypy .",
    "python -m build",
  ],
};

const TOOL_SETUP_COMMANDS: Record<PythonPackageManager, string> = {
  pip: "python -m pip install ruff pytest mypy",
  uv: "uv pip install ruff pytest mypy",
  poetry: "poetry run python -m pip install ruff pytest mypy",
  pipenv: "pipenv run python -m pip install ruff pytest mypy",
};

describe("generatePythonWorkflow", () => {
  it("uses the configured branch and Python version without Flutter or Node steps", () => {
    const yaml = generatePythonWorkflow(
      createPythonConfig({
        branch: "develop",
        pythonVersion: "3.13",
      }),
    );
    const workflow = YAML.parse(yaml) as WorkflowObject;
    const setupPython = workflow.jobs.quality.steps.find(
      (step) => step.uses === "actions/setup-python@v6",
    );

    expect(workflow.on.push).toEqual({
      branches: ["develop"],
    });
    expect(workflow.on.pull_request).toEqual({
      branches: ["develop"],
    });
    expect(setupPython?.with?.["python-version"]).toBe("3.13");
    expect(workflow.jobs.quality["runs-on"]).toBe("ubuntu-latest");
    expect(yaml).not.toContain("subosito/flutter-action");
    expect(yaml).not.toContain("actions/setup-node");
    expect(yaml).not.toMatch(/(?:npm|pnpm|yarn|bun) (?:install|run)/u);
  });

  it.each(INSTALL_CASES)(
    "uses $packageManager install when frozenLockfile=$frozenLockfile and source=$dependencySource",
    ({
      packageManager,
      dependencySource,
      frozenLockfile,
      command,
    }) => {
      const workflow = generateWorkflowObject(
        createPythonConfig({
          packageManager,
          dependencySource,
          frozenLockfile,
        }),
      );

      expect(
        workflow.jobs.quality.steps.find(
          (step) => step.name === "Install dependencies",
        )?.run,
      ).toBe(command);
    },
  );

  it.each(
    Object.entries(TASK_COMMANDS) as Array<
      [PythonPackageManager, [string, string, string, string]]
    >,
  )("generates package-manager-aware %s task commands", (manager, expected) => {
    const dependencySource =
      manager === "pipenv" ? "pipfile" : "project";
    const commands = generateWorkflowObject(
      createPythonConfig({
        packageManager: manager,
        dependencySource,
        frozenLockfile: false,
      }),
    ).jobs.quality.steps
      .map((step) => step.run)
      .filter((command): command is string => typeof command === "string");

    for (const command of expected) {
      expect(commands).toContain(command);
    }

    expect(commands).toContain(
      TOOL_SETUP_COMMANDS[manager],
    );
  });

  it("omits disabled tasks and the distribution artifact", () => {
    const workflow = generateWorkflowObject(
      createPythonConfig({
        tasks: {
          ruff: false,
          pytest: false,
          mypy: false,
          build: false,
        },
      }),
    );
    const steps = workflow.jobs.quality.steps;

    expect(steps.some((step) => step.name === "Ruff")).toBe(false);
    expect(steps.some((step) => step.name === "Run tests")).toBe(false);
    expect(steps.some((step) => step.name === "Mypy")).toBe(false);
    expect(steps.some((step) => step.name === "Build package")).toBe(false);
    expect(
      steps.some(
        (step) => step.name === "Install selected Python tools",
      ),
    ).toBe(false);
    expect(
      steps.some(
        (step) => step.uses === "actions/upload-artifact@v4",
      ),
    ).toBe(false);
  });

  it("provisions only the enabled quality tools", () => {
    const steps = generateWorkflowObject(
      createPythonConfig({
        tasks: {
          ruff: true,
          pytest: false,
          mypy: false,
          build: false,
        },
      }),
    ).jobs.quality.steps;

    expect(
      steps.find(
        (step) => step.name === "Install selected Python tools",
      )?.run,
    ).toBe("uv pip install ruff");
  });

  it("uploads successful package builds as python-dist", () => {
    const steps = generateWorkflowObject(
      createPythonConfig(),
    ).jobs.quality.steps;
    const artifact = steps.find(
      (step) => step.uses === "actions/upload-artifact@v4",
    );

    expect(artifact?.with).toEqual({
      name: "python-dist",
      path: "dist/*",
    });
    expect(
      steps.findIndex((step) => step.name === "Build package"),
    ).toBeLessThan(
      steps.findIndex(
        (step) => step.name === "Upload Python distributions",
      ),
    );
  });

  it("keeps manual-only trigger branch metadata", () => {
    const yaml = generatePythonWorkflow(
      createPythonConfig({
        branch: "release/python",
        trigger: {
          push: false,
          pullRequest: false,
          manual: true,
        },
      }),
    );
    const workflow = YAML.parse(yaml) as WorkflowObject;

    expect(workflow.on).toEqual({
      workflow_dispatch: {},
    });
    expect(yaml).toMatch(
      /^# Managed by Homemade CI\/CD\n# homemade-project-type: python\n# homemade-trigger-branch: "release\/python"/u,
    );
  });
});
