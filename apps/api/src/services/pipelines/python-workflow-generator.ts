import type {
  PythonDependencySource,
  PythonPackageManager,
  PythonPipelineConfig,
} from "@homemade-cicd/core";

import {
  createWorkflowTriggers,
  formatManagedWorkflow,
  type WorkflowStep,
} from "./workflow-format.js";

type PythonTask = keyof PythonPipelineConfig["tasks"];
type PythonToolTask = Exclude<PythonTask, "build">;

const REQUIREMENTS_FILES = {
  requirements: "requirements.txt",
  "requirements-dev": "requirements-dev.txt",
  requirements_dev: "requirements_dev.txt",
} as const satisfies Partial<
  Record<PythonDependencySource, string>
>;

const TASK_LABELS = {
  ruff: "Ruff",
  pytest: "Run tests",
  mypy: "Mypy",
  build: "Build package",
} as const satisfies Record<PythonTask, string>;

const TASK_PACKAGES = {
  ruff: "ruff",
  pytest: "pytest",
  mypy: "mypy",
} as const satisfies Record<PythonToolTask, string>;

function createPackageManagerSetupSteps(
  packageManager: PythonPackageManager,
  buildEnabled: boolean,
): WorkflowStep[] {
  const buildSetup =
    buildEnabled &&
    (packageManager === "pip" || packageManager === "pipenv")
      ? [
          {
            name: "Install build frontend",
            run: "python -m pip install build",
          },
        ]
      : [];

  switch (packageManager) {
    case "pip":
      return [
        {
          name: "Upgrade pip",
          run: "python -m pip install --upgrade pip",
        },
        ...buildSetup,
      ];

    case "uv":
      return [
        {
          name: "Install uv",
          run: "python -m pip install uv",
        },
      ];

    case "poetry":
      return [
        {
          name: "Install Poetry",
          run: "python -m pip install poetry",
        },
      ];

    case "pipenv":
      return [
        {
          name: "Install Pipenv",
          run: "python -m pip install pipenv",
        },
        ...buildSetup,
      ];
  }
}

function createPipInstallCommand(
  dependencySource: PythonDependencySource,
): string {
  const requirementsFile =
    REQUIREMENTS_FILES[
      dependencySource as keyof typeof REQUIREMENTS_FILES
    ];

  return requirementsFile
    ? `python -m pip install -r ${requirementsFile}`
    : "python -m pip install .";
}

function createInstallCommand(
  config: PythonPipelineConfig,
): string {
  switch (config.packageManager) {
    case "pip":
      return createPipInstallCommand(
        config.dependencySource,
      );

    case "uv":
      return config.frozenLockfile
        ? "uv sync --locked"
        : "uv sync";

    case "poetry":
      return config.frozenLockfile
        ? "poetry sync --no-interaction"
        : "poetry install --no-interaction";

    case "pipenv":
      return config.frozenLockfile
        ? "pipenv sync --dev"
        : "pipenv install --dev";
  }
}

function createToolSetupSteps(
  packageManager: PythonPackageManager,
  enabledTasks: PythonTask[],
): WorkflowStep[] {
  const packages = enabledTasks
    .filter((task): task is PythonToolTask => task !== "build")
    .map((task) => TASK_PACKAGES[task]);

  if (packages.length === 0) {
    return [];
  }

  const packageList = packages.join(" ");
  const command =
    packageManager === "pip"
      ? `python -m pip install ${packageList}`
      : packageManager === "uv"
        ? `uv pip install ${packageList}`
        : packageManager === "poetry"
          ? `poetry run python -m pip install ${packageList}`
          : `pipenv run python -m pip install ${packageList}`;

  return [
    {
      name: "Install selected Python tools",
      run: command,
    },
  ];
}

function createTaskCommand(
  packageManager: PythonPackageManager,
  task: PythonTask,
): string {
  const command =
    task === "ruff"
      ? "ruff check ."
      : task === "pytest"
        ? "pytest"
        : task === "mypy"
          ? "mypy ."
          : packageManager === "uv"
            ? "uv build"
            : packageManager === "poetry"
              ? "poetry build"
              : "python -m build";

  if (task === "build") {
    return command;
  }

  switch (packageManager) {
    case "pip":
      return command;

    case "uv":
      return `uv run ${command}`;

    case "poetry":
      return `poetry run ${command}`;

    case "pipenv":
      return `pipenv run ${command}`;
  }
}

export function generatePythonWorkflow(
  config: PythonPipelineConfig,
): string {
  const enabledTasks = (
    Object.keys(config.tasks) as PythonTask[]
  ).filter((task) => config.tasks[task]);
  const steps: WorkflowStep[] = [
    {
      name: "Checkout repository",
      uses: "actions/checkout@v4",
    },
    {
      name: "Set up Python",
      uses: "actions/setup-python@v6",
      with: {
        "python-version": config.pythonVersion,
      },
    },
    ...createPackageManagerSetupSteps(
      config.packageManager,
      config.tasks.build,
    ),
    {
      name: "Install dependencies",
      run: createInstallCommand(config),
    },
    ...createToolSetupSteps(
      config.packageManager,
      enabledTasks,
    ),
    ...enabledTasks.map((task) => ({
      name: TASK_LABELS[task],
      run: createTaskCommand(
        config.packageManager,
        task,
      ),
    })),
    ...(config.tasks.build
      ? [
          {
            name: "Upload Python distributions",
            uses: "actions/upload-artifact@v4",
            with: {
              name: "python-dist",
              path: "dist/*",
            },
          },
        ]
      : []),
  ];
  const workflow = {
    name: "Homemade CI/CD",
    on: createWorkflowTriggers(
      config.branch,
      config.trigger,
    ),
    permissions: {
      contents: "read",
    },
    jobs: {
      quality: {
        name: "Python pipeline",
        "runs-on": "ubuntu-latest",
        steps,
      },
    },
  };

  return formatManagedWorkflow(
    "python",
    workflow,
    config.branch,
  );
}
