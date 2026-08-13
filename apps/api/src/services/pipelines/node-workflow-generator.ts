import type {
  NodePipelineConfig,
  PackageManager,
} from "@homemade-cicd/core";

import {
  createWorkflowTriggers,
  formatManagedWorkflow,
  type WorkflowStep,
} from "./workflow-format.js";

const TASK_LABELS = {
  lint: "Lint",
  typecheck: "Typecheck",
  test: "Run tests",
  build: "Build",
} as const;

type NodeTask = keyof NodePipelineConfig["tasks"];

function createPackageManagerSetupSteps(
  packageManager: PackageManager,
): WorkflowStep[] {
  if (packageManager === "pnpm") {
    return [
      {
        name: "Set up pnpm",
        uses: "pnpm/action-setup@v4",
        with: {
          version: "latest",
        },
      },
    ];
  }

  if (packageManager === "yarn") {
    return [
      {
        name: "Install Corepack",
        run: "npm install --global corepack@0.34.7",
      },
      {
        name: "Enable Corepack",
        run: "corepack enable",
      },
    ];
  }

  if (packageManager === "bun") {
    return [
      {
        name: "Set up Bun",
        uses: "oven-sh/setup-bun@v2",
      },
    ];
  }

  return [];
}

function createInstallCommand(
  packageManager: PackageManager,
  frozenLockfile: boolean,
): string {
  switch (packageManager) {
    case "npm":
      return frozenLockfile
        ? "npm ci"
        : "npm install";

    case "pnpm":
      return frozenLockfile
        ? "pnpm install --frozen-lockfile"
        : "pnpm install";

    case "yarn":
      return frozenLockfile
        ? "yarn install --frozen-lockfile"
        : "yarn install";

    case "bun":
      return frozenLockfile
        ? "bun install --frozen-lockfile"
        : "bun install";
  }
}

function createScriptCommand(
  packageManager: PackageManager,
  task: NodeTask,
): string {
  return `${packageManager} run ${task}`;
}

export function generateNodeWorkflow(
  config: NodePipelineConfig,
): string {
  const enabledTasks = (
    Object.keys(config.tasks) as NodeTask[]
  ).filter((task) => config.tasks[task]);

  const steps: WorkflowStep[] = [
    {
      name: "Checkout repository",
      uses: "actions/checkout@v4",
    },
    {
      name: "Set up Node.js",
      uses: "actions/setup-node@v4",
      with: {
        "node-version": config.nodeVersion,
      },
    },
    ...createPackageManagerSetupSteps(
      config.packageManager,
    ),
    {
      name: "Install dependencies",
      run: createInstallCommand(
        config.packageManager,
        config.frozenLockfile,
      ),
    },
    ...enabledTasks.map((task) => ({
      name: TASK_LABELS[task],
      run: createScriptCommand(
        config.packageManager,
        task,
      ),
    })),
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
        name: "Node.js pipeline",
        "runs-on": "ubuntu-latest",
        steps,
      },
    },
  };

  return formatManagedWorkflow(
    "node",
    workflow,
    config.branch,
  );
}
