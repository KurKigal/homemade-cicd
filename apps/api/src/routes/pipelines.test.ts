import Fastify from "fastify";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock(
  "../services/pipelines/pipeline-management-service.js",
  () => ({
    deleteManagedPipeline: vi.fn(),
    disablePipeline: vi.fn(),
    enablePipeline: vi.fn(),
    getPipelineDetails: vi.fn(),
    listRepositoryPipelines: vi.fn(),
  }),
);

vi.mock(
  "../services/pipelines/pipeline-service.js",
  () => ({
    saveWorkflow: vi.fn(),
  }),
);

import {
  pipelineRoutes,
} from "./pipelines.js";
import {
  saveWorkflow,
} from "../services/pipelines/pipeline-service.js";

const flutterConfig = {
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
    aab: false,
  },
  ios: {
    enabled: false,
    unsignedBuild: false,
  },
};

const nodeConfig = {
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

const pythonConfig = {
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
    mypy: false,
    build: true,
  },
};

describe("pipeline routes", () => {
  it.each([
    ["flutter", flutterConfig],
    ["node", nodeConfig],
    ["python", pythonConfig],
  ] as const)(
    "previews a valid %s managed pipeline",
    async (projectType, config) => {
      const app = Fastify();
      await app.register(pipelineRoutes);

      try {
        const response = await app.inject({
          method: "POST",
          url: "/github/repos/example/project/pipeline/preview",
          payload: {
            projectType,
            config,
          },
        });
        const body = response.json();

        expect(response.statusCode).toBe(200);
        expect(body).toMatchObject({
          repository: {
            owner: "example",
            repo: "project",
          },
        });
        expect(body.yaml).toContain(
          `# homemade-project-type: ${projectType}`,
        );
      } finally {
        await app.close();
      }
    },
  );

  it("applies a valid Node.js managed pipeline", async () => {
    const mockedSaveWorkflow = vi.mocked(saveWorkflow);
    mockedSaveWorkflow.mockResolvedValueOnce({
      path: ".github/workflows/homemade-ci.yml",
      commitSha: "commit-sha",
      commitUrl: undefined,
      created: true,
    });

    const app = Fastify();
    await app.register(pipelineRoutes);

    try {
      const response = await app.inject({
        method: "PUT",
        url: "/github/repos/example/project/pipeline",
        payload: {
          projectType: "node",
          config: nodeConfig,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        workflow: {
          path: ".github/workflows/homemade-ci.yml",
          created: true,
        },
      });
      expect(mockedSaveWorkflow).toHaveBeenCalledWith({
        owner: "example",
        repo: "project",
        yaml: expect.stringContaining(
          "# homemade-project-type: node",
        ),
      });
    } finally {
      await app.close();
    }
  });

  it("applies a valid Python managed pipeline", async () => {
    const mockedSaveWorkflow = vi.mocked(saveWorkflow);
    mockedSaveWorkflow.mockResolvedValueOnce({
      path: ".github/workflows/homemade-ci.yml",
      commitSha: "python-commit-sha",
      commitUrl: undefined,
      created: false,
    });

    const app = Fastify();
    await app.register(pipelineRoutes);

    try {
      const response = await app.inject({
        method: "PUT",
        url: "/github/repos/example/project/pipeline",
        payload: {
          projectType: "python",
          config: pythonConfig,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        workflow: {
          path: ".github/workflows/homemade-ci.yml",
          created: false,
        },
      });
      expect(mockedSaveWorkflow).toHaveBeenCalledWith({
        owner: "example",
        repo: "project",
        yaml: expect.stringContaining(
          "# homemade-project-type: python",
        ),
      });
    } finally {
      await app.close();
    }
  });

  it.each([
    {
      caseName: "Flutter discriminator with Node.js config",
      payload: {
        projectType: "flutter",
        config: nodeConfig,
      },
    },
    {
      caseName: "Node.js discriminator with Flutter config",
      payload: {
        projectType: "node",
        config: flutterConfig,
      },
    },
    {
      caseName: "unsupported project type",
      payload: {
        projectType: "ruby",
        config: nodeConfig,
      },
    },
    {
      caseName: "blank branch",
      payload: {
        projectType: "node",
        config: {
          ...nodeConfig,
          branch: " ",
        },
      },
    },
    {
      caseName: "unsupported package manager",
      payload: {
        projectType: "node",
        config: {
          ...nodeConfig,
          packageManager: "composer",
        },
      },
    },
    {
      caseName: "blank Python version",
      payload: {
        projectType: "python",
        config: {
          ...pythonConfig,
          pythonVersion: " ",
        },
      },
    },
    {
      caseName: "unsupported Python package manager",
      payload: {
        projectType: "python",
        config: {
          ...pythonConfig,
          packageManager: "conda",
        },
      },
    },
    {
      caseName: "invalid Python task structure",
      payload: {
        projectType: "python",
        config: {
          ...pythonConfig,
          tasks: {
            pytest: true,
          },
        },
      },
    },
    {
      caseName: "missing Python branch",
      payload: {
        projectType: "python",
        config: {
          pythonVersion: pythonConfig.pythonVersion,
          packageManager: pythonConfig.packageManager,
          dependencySource: pythonConfig.dependencySource,
          frozenLockfile: pythonConfig.frozenLockfile,
          trigger: pythonConfig.trigger,
          tasks: pythonConfig.tasks,
        },
      },
    },
    {
      caseName: "incompatible Python dependency source",
      payload: {
        projectType: "python",
        config: {
          ...pythonConfig,
          dependencySource: "pipfile",
        },
      },
    },
    {
      caseName: "pip with managed frozen lockfile semantics",
      payload: {
        projectType: "python",
        config: {
          ...pythonConfig,
          packageManager: "pip",
          dependencySource: "requirements",
          frozenLockfile: true,
        },
      },
    },
  ])(
    "rejects $caseName",
    async ({ payload }) => {
      const app = Fastify();

      await app.register(pipelineRoutes);

      try {
        const response = await app.inject({
          method: "POST",
          url: "/github/repos/example/project/pipeline/preview",
          payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({
          error: "Invalid pipeline configuration.",
        });
      } finally {
        await app.close();
      }
    },
  );

  it("rejects invalid configuration on apply without saving", async () => {
    const mockedSaveWorkflow = vi.mocked(saveWorkflow);
    mockedSaveWorkflow.mockClear();

    const app = Fastify();
    await app.register(pipelineRoutes);

    try {
      const response = await app.inject({
        method: "PUT",
        url: "/github/repos/example/project/pipeline",
        payload: {
          projectType: "node",
          config: {
            ...nodeConfig,
            branch: " ",
          },
        },
      });

      expect(response.statusCode).toBe(400);
      expect(mockedSaveWorkflow).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
