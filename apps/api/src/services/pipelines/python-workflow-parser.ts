import {
  pythonPipelineSchema,
  type PythonDependencySource,
  type PythonPackageManager,
  type PythonPipelineConfig,
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
  readSteps,
} from "./workflow-parser-utils.js";

type PythonTask = keyof PythonPipelineConfig["tasks"];

const PIP_REQUIREMENTS_SOURCES = {
  "python -m pip install -r requirements.txt": "requirements",
  "python -m pip install -r requirements-dev.txt": "requirements-dev",
  "python -m pip install -r requirements_dev.txt": "requirements_dev",
} as const satisfies Record<string, PythonDependencySource>;

function detectPackageManager(
  commands: string[],
): PythonPackageManager {
  if (commands.some((command) =>
    command.trim().startsWith("uv sync"),
  )) {
    return "uv";
  }

  if (commands.some((command) => {
    const normalized = command.trim();

    return normalized.startsWith("poetry sync") ||
      normalized.startsWith("poetry install");
  })) {
    return "poetry";
  }

  if (commands.some((command) => {
    const normalized = command.trim();

    return normalized.startsWith("pipenv sync") ||
      normalized.startsWith("pipenv install");
  })) {
    return "pipenv";
  }

  if (commands.some((command) => {
    const normalized = command.trim();

    return normalized === "python -m pip install ." ||
      normalized in PIP_REQUIREMENTS_SOURCES;
  })) {
    return "pip";
  }

  throw new Error(
    "Python workflow package manager could not be determined.",
  );
}

function detectDependencySource(
  commands: string[],
  packageManager: PythonPackageManager,
): PythonDependencySource {
  if (packageManager === "pipenv") {
    return "pipfile";
  }

  if (packageManager !== "pip") {
    return "project";
  }

  for (const command of commands) {
    const normalized = command.trim();

    if (normalized in PIP_REQUIREMENTS_SOURCES) {
      return PIP_REQUIREMENTS_SOURCES[
        normalized as keyof typeof PIP_REQUIREMENTS_SOURCES
      ];
    }
  }

  if (containsCommand(commands, "python -m pip install .")) {
    return "project";
  }

  throw new Error(
    "Python workflow dependency source could not be determined.",
  );
}

function isFrozenInstall(
  commands: string[],
  packageManager: PythonPackageManager,
): boolean {
  switch (packageManager) {
    case "pip":
      return false;

    case "uv":
      return containsCommand(commands, "uv sync --locked") ||
        containsCommand(commands, "uv sync --frozen");

    case "poetry":
      return containsCommand(
        commands,
        "poetry sync --no-interaction",
      );

    case "pipenv":
      return containsCommand(commands, "pipenv sync --dev");
  }
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

  if (task === "build" || packageManager === "pip") {
    return command;
  }

  return `${packageManager} run ${command}`;
}

function readPythonVersion(job: unknown): string {
  const setupPythonStep = readSteps(job).find(
    (step) =>
      typeof step.uses === "string" &&
      step.uses.startsWith("actions/setup-python@"),
  );
  const setupOptions = asRecord(setupPythonStep?.with);
  const pythonVersion = setupOptions?.["python-version"];

  if (
    typeof pythonVersion !== "string" &&
    typeof pythonVersion !== "number"
  ) {
    throw new Error(
      "Python workflow version could not be determined.",
    );
  }

  return String(pythonVersion);
}

export function parsePythonWorkflow(
  yaml: string,
  fallbackBranch: string,
): PythonPipelineConfig {
  const root = parseWorkflowRoot(yaml);
  const triggers = asRecord(root.on) ?? {};
  const jobs = asRecord(root.jobs) ?? {};
  const quality = jobs.quality;
  const commands = readCommands(quality);
  const packageManager = detectPackageManager(commands);
  const branch =
    firstBranch(triggers.push) ??
    firstBranch(triggers.pull_request) ??
    readManagedTriggerBranch(yaml) ??
    fallbackBranch;

  return pythonPipelineSchema.parse({
    branch,
    pythonVersion: readPythonVersion(quality),
    packageManager,
    dependencySource: detectDependencySource(
      commands,
      packageManager,
    ),
    frozenLockfile: isFrozenInstall(
      commands,
      packageManager,
    ),
    trigger: {
      push: "push" in triggers,
      pullRequest: "pull_request" in triggers,
      manual: "workflow_dispatch" in triggers,
    },
    tasks: {
      ruff: containsCommand(
        commands,
        createTaskCommand(packageManager, "ruff"),
      ),
      pytest: containsCommand(
        commands,
        createTaskCommand(packageManager, "pytest"),
      ),
      mypy: containsCommand(
        commands,
        createTaskCommand(packageManager, "mypy"),
      ),
      build: containsCommand(
        commands,
        createTaskCommand(packageManager, "build"),
      ),
    },
  });
}
