import {
  describe,
  expect,
  it,
} from "vitest";

import YAML from "yaml";

import type {
  NodePipelineConfig,
  PackageManager,
} from "@homemade-cicd/core";

import {
  generateNodeWorkflow,
} from "./node-workflow-generator.js";

type NodeTask = keyof NodePipelineConfig["tasks"];

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

const PACKAGE_MANAGERS: PackageManager[] = [
  "pnpm",
  "npm",
  "yarn",
  "bun",
];

const TASKS: NodeTask[] = [
  "lint",
  "typecheck",
  "test",
  "build",
];

function createNodeConfig(
  overrides: Partial<NodePipelineConfig> = {},
): NodePipelineConfig {
  const base: NodePipelineConfig = {
    branch: "main",
    nodeVersion: "24",
    packageManager: "pnpm",
    frozenLockfile: true,
    trigger: {
      push: true,
      pullRequest: true,
      manual: true,
    },
    tasks: {
      lint: true,
      typecheck: true,
      test: true,
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
  config: NodePipelineConfig,
): WorkflowObject {
  return YAML.parse(
    generateNodeWorkflow(config),
  ) as WorkflowObject;
}

function expectedTaskCommand(
  packageManager: PackageManager,
  task: NodeTask,
): string {
  return packageManager === "yarn"
    ? `yarn run ${task}`
    : `${packageManager} run ${task}`;
}

const INSTALL_CASES: Array<{
  packageManager: PackageManager;
  frozenLockfile: boolean;
  command: string;
}> = [
  {
    packageManager: "npm",
    frozenLockfile: true,
    command: "npm ci",
  },
  {
    packageManager: "npm",
    frozenLockfile: false,
    command: "npm install",
  },
  {
    packageManager: "pnpm",
    frozenLockfile: true,
    command: "pnpm install --frozen-lockfile",
  },
  {
    packageManager: "pnpm",
    frozenLockfile: false,
    command: "pnpm install",
  },
  {
    packageManager: "yarn",
    frozenLockfile: true,
    command: "yarn install --frozen-lockfile",
  },
  {
    packageManager: "yarn",
    frozenLockfile: false,
    command: "yarn install",
  },
  {
    packageManager: "bun",
    frozenLockfile: true,
    command: "bun install --frozen-lockfile",
  },
  {
    packageManager: "bun",
    frozenLockfile: false,
    command: "bun install",
  },
];

const TRIGGER_CASES = Array.from(
  { length: 8 },
  (_, value) => ({
    push: Boolean(value & 1),
    pullRequest: Boolean(value & 2),
    manual: Boolean(value & 4),
  }),
);

const TASK_CASES = Array.from(
  { length: 16 },
  (_, selection) => {
    return {
      selection,
      tasks: {
        lint: Boolean(selection & 1),
        typecheck: Boolean(selection & 2),
        test: Boolean(selection & 4),
        build: Boolean(selection & 8),
      } satisfies NodePipelineConfig["tasks"],
    };
  },
);

describe("generateNodeWorkflow", () => {
  it("uses the configured branch and Node.js version without Flutter steps", () => {
    const yaml = generateNodeWorkflow(
      createNodeConfig({
        branch: "develop",
        nodeVersion: "20",
      }),
    );
    const workflow = YAML.parse(yaml) as WorkflowObject;
    const steps = workflow.jobs.quality.steps;

    expect(workflow.on.push).toEqual({
      branches: ["develop"],
    });
    expect(workflow.on.pull_request).toEqual({
      branches: ["develop"],
    });
    expect(
      steps.find(
        (step) => step.uses === "actions/setup-node@v4",
      )?.with?.["node-version"],
    ).toBe("20");
    expect(yaml).not.toContain(
      "subosito/flutter-action",
    );
    expect(yaml).not.toMatch(/flutter (?:pub|get|analyze|test|build)/u);
  });

  it.each(INSTALL_CASES)(
    "uses the correct $packageManager install command when frozenLockfile=$frozenLockfile",
    ({ packageManager, frozenLockfile, command }) => {
      const workflow = generateWorkflowObject(
        createNodeConfig({
          packageManager,
          frozenLockfile,
        }),
      );

      const steps = workflow.jobs.quality.steps;
      const setupNode = steps.find(
        (step) => step.uses === "actions/setup-node@v4",
      );

      expect(workflow.jobs.quality["runs-on"]).toBe(
        "ubuntu-latest",
      );
      expect(setupNode?.with?.["node-version"]).toBe(
        "24",
      );
      expect(
        steps.find(
          (step) => step.name === "Install dependencies",
        )?.run,
      ).toBe(command);

      expect(setupNode?.with?.cache).toBeUndefined();
    },
  );

  it("adds package-manager-specific setup steps", () => {
    const pnpmSteps = generateWorkflowObject(
      createNodeConfig({ packageManager: "pnpm" }),
    ).jobs.quality.steps;
    const yarnSteps = generateWorkflowObject(
      createNodeConfig({ packageManager: "yarn" }),
    ).jobs.quality.steps;
    const bunSteps = generateWorkflowObject(
      createNodeConfig({ packageManager: "bun" }),
    ).jobs.quality.steps;

    expect(
      pnpmSteps.some(
        (step) =>
          step.uses === "pnpm/action-setup@v4" &&
          step.with?.version === "latest",
      ),
    ).toBe(true);
    expect(
      yarnSteps.some(
        (step) =>
          step.run ===
          "npm install --global corepack@0.34.7",
      ),
    ).toBe(true);
    expect(
      yarnSteps.some(
        (step) => step.run === "corepack enable",
      ),
    ).toBe(true);
    expect(
      bunSteps.some(
        (step) => step.uses === "oven-sh/setup-bun@v2",
      ),
    ).toBe(true);
  });

  it.each(
    PACKAGE_MANAGERS.flatMap((packageManager) =>
      TASK_CASES.map(({ selection, tasks }) => ({
        packageManager,
        selection,
        tasks,
      })),
    ),
  )(
    "generates $packageManager task selection $selection",
    ({ packageManager, tasks }) => {
      const workflow = generateWorkflowObject(
        createNodeConfig({
          packageManager,
          tasks,
        }),
      );
      const commands = workflow.jobs.quality.steps
        .map((step) => step.run)
        .filter((command): command is string =>
          typeof command === "string",
        );

      for (const task of TASKS) {
        const assertion = expect(commands);
        const command = expectedTaskCommand(
          packageManager,
          task,
        );

        if (tasks[task]) {
          assertion.toContain(command);
        } else {
          assertion.not.toContain(command);
        }
      }
    },
  );

  it.each(TRIGGER_CASES)(
    "generates push=$push pullRequest=$pullRequest manual=$manual triggers",
    (trigger) => {
      const workflow = generateWorkflowObject(
        createNodeConfig({ trigger }),
      );
      const noTriggerSelected =
        !trigger.push &&
        !trigger.pullRequest &&
        !trigger.manual;

      expect("push" in workflow.on).toBe(trigger.push);
      expect("pull_request" in workflow.on).toBe(
        trigger.pullRequest,
      );
      expect("workflow_dispatch" in workflow.on).toBe(
        trigger.manual || noTriggerSelected,
      );

      if (trigger.push) {
        expect(workflow.on.push).toEqual({
          branches: ["main"],
        });
      }

      if (trigger.pullRequest) {
        expect(workflow.on.pull_request).toEqual({
          branches: ["main"],
        });
      }
    },
  );

  it("adds Homemade ownership and Node.js project markers", () => {
    const yaml = generateNodeWorkflow(
      createNodeConfig(),
    );

    expect(yaml).toMatch(
      /^# Managed by Homemade CI\/CD\n# homemade-project-type: node\n/u,
    );
  });

});
