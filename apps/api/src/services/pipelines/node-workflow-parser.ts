import {
  nodePipelineSchema,
  type NodePipelineConfig,
  type PackageManager,
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

type NodeTask = keyof NodePipelineConfig["tasks"];

function detectPackageManager(
  commands: string[],
): PackageManager {
  if (commands.some((command) =>
    command.trim().startsWith("pnpm install"),
  )) {
    return "pnpm";
  }

  if (commands.some((command) =>
    command.trim().startsWith("yarn install"),
  )) {
    return "yarn";
  }

  if (commands.some((command) =>
    command.trim().startsWith("bun install"),
  )) {
    return "bun";
  }

  if (commands.some((command) => {
    const normalized = command.trim();

    return normalized === "npm ci" ||
      normalized.startsWith("npm install");
  })) {
    return "npm";
  }

  throw new Error(
    "Node workflow package manager could not be determined.",
  );
}

function isFrozenInstall(
  commands: string[],
  packageManager: PackageManager,
): boolean {
  switch (packageManager) {
    case "npm":
      return containsCommand(commands, "npm ci");

    case "pnpm":
      return containsCommand(
        commands,
        "pnpm install --frozen-lockfile",
      );

    case "yarn":
      return commands.some((command) => {
        const normalized = command.trim();

        return normalized === "yarn install --immutable" ||
          normalized === "yarn install --frozen-lockfile";
      });

    case "bun":
      return containsCommand(
        commands,
        "bun install --frozen-lockfile",
      );
  }
}

function hasTaskCommand(
  commands: string[],
  packageManager: PackageManager,
  task: NodeTask,
): boolean {
  if (packageManager === "yarn") {
    return containsCommand(commands, `yarn ${task}`) ||
      containsCommand(commands, `yarn run ${task}`);
  }

  return containsCommand(
    commands,
    `${packageManager} run ${task}`,
  );
}

function readNodeVersion(
  job: unknown,
): string {
  const setupNodeStep = readSteps(job).find(
    (step) =>
      typeof step.uses === "string" &&
      step.uses.startsWith("actions/setup-node@"),
  );

  const setupOptions = asRecord(
    setupNodeStep?.with,
  );

  const nodeVersion =
    setupOptions?.["node-version"];

  if (
    typeof nodeVersion !== "string" &&
    typeof nodeVersion !== "number"
  ) {
    throw new Error(
      "Node workflow version could not be determined.",
    );
  }

  return String(nodeVersion);
}

export function parseNodeWorkflow(
  yaml: string,
  fallbackBranch: string,
): NodePipelineConfig {
  const root = parseWorkflowRoot(yaml);
  const triggers = asRecord(root.on) ?? {};
  const jobs = asRecord(root.jobs) ?? {};
  const quality = jobs.quality;
  const commands = readCommands(quality);
  const packageManager =
    detectPackageManager(commands);

  const branch =
    firstBranch(triggers.push) ??
    firstBranch(triggers.pull_request) ??
    readManagedTriggerBranch(yaml) ??
    fallbackBranch;

  return nodePipelineSchema.parse({
    branch,
    nodeVersion: readNodeVersion(quality),
    packageManager,
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
      lint: hasTaskCommand(
        commands,
        packageManager,
        "lint",
      ),
      typecheck: hasTaskCommand(
        commands,
        packageManager,
        "typecheck",
      ),
      test: hasTaskCommand(
        commands,
        packageManager,
        "test",
      ),
      build: hasTaskCommand(
        commands,
        packageManager,
        "build",
      ),
    },
  });
}
