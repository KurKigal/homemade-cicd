import {
  describe,
  expect,
  it,
} from "vitest";

import {
  detectProject,
} from "./project-detector.js";

import type {
  RepositoryReader,
} from "./repositories/repository-reader.js";

class FakeRepositoryReader
  implements RepositoryReader
{
  constructor(
    private readonly rootEntries: string[],
    private readonly files: Record<string, string> = {},
    private readonly existingPaths: string[] = [],
  ) {}

  async listRootEntryNames(): Promise<Set<string>> {
    return new Set(this.rootEntries);
  }

  async readTextFile(
    _owner: string,
    _repo: string,
    path: string,
  ): Promise<string | null> {
    return this.files[path] ?? null;
  }

  async pathExists(
    _owner: string,
    _repo: string,
    path: string,
  ): Promise<boolean> {
    return this.existingPaths.includes(path);
  }
}

describe("detectProject", () => {
  it("detects a Flutter project and its platforms", async () => {
    const reader = new FakeRepositoryReader(
      [
        "pubspec.yaml",
        "android",
        "ios",
        "web",
      ],
      {
        "pubspec.yaml": `
name: test_app

dependencies:
  flutter:
    sdk: flutter
`,
      },
    );

    const result = await detectProject(
      reader,
      "example",
      "flutter-app",
    );

    expect(result).toEqual({
      projectType: "flutter",
      framework: "Flutter",
      language: "Dart",
      packageManager: null,
      lockfilePresent: false,
      availableScripts: [],
      python: null,

      platforms: {
        android: true,
        ios: true,
        web: true,
      },

      ciConfigured: false,

      signals: [
        "pubspec.yaml",
        "android/",
        "ios/",
        "web/",
      ],
    });
  });

  it("does not classify every Dart pubspec project as Flutter", async () => {
    const reader = new FakeRepositoryReader(
      ["pubspec.yaml"],
      {
        "pubspec.yaml": `
name: dart_cli

environment:
  sdk: ^3.0.0

dependencies:
  args: ^2.0.0
`,
      },
    );

    const result = await detectProject(
      reader,
      "example",
      "dart-cli",
    );

    expect(result.projectType).toBe(
      "unknown",
    );

    expect(result.framework).toBeNull();
  });

  it("detects React + Vite, pnpm and available package scripts", async () => {
    const reader = new FakeRepositoryReader(
      [
        "package.json",
        "pnpm-lock.yaml",
        "src",
      ],
      {
        "package.json": JSON.stringify({
          dependencies: {
            react: "^19.0.0",
          },
          devDependencies: {
            vite: "^8.0.0",
          },
          scripts: {
            test: "vitest run",
            build: "vite build",
            ignored: false,
            lint: "eslint .",
          },
        }),
      },
    );

    const result = await detectProject(
      reader,
      "example",
      "web-app",
    );

    expect(result.projectType).toBe(
      "node",
    );

    expect(result.framework).toBe(
      "React + Vite",
    );

    expect(result.packageManager).toBe(
      "pnpm",
    );

    expect(result.language).toBe(
      "TypeScript / JavaScript",
    );

    expect(result.lockfilePresent).toBe(
      true,
    );

    expect(result.availableScripts).toEqual([
      "build",
      "lint",
      "test",
    ]);
  });

  it("detects Next.js before generic React", async () => {
    const reader = new FakeRepositoryReader(
      [
        "package.json",
        "package-lock.json",
      ],
      {
        "package.json": JSON.stringify({
          dependencies: {
            next: "^15.0.0",
            react: "^19.0.0",
          },
        }),
      },
    );

    const result = await detectProject(
      reader,
      "example",
      "next-app",
    );

    expect(result.projectType).toBe(
      "node",
    );

    expect(result.framework).toBe(
      "Next.js",
    );

    expect(result.packageManager).toBe(
      "npm",
    );
  });

  it.each([
    ["NestJS", "@nestjs/core"],
    ["Fastify", "fastify"],
    ["Express", "express"],
    ["React", "react"],
  ])(
    "detects %s from package.json dependencies",
    async (framework, dependency) => {
      const reader = new FakeRepositoryReader(
        ["package.json"],
        {
          "package.json": JSON.stringify({
            dependencies: {
              [dependency]: "latest",
            },
          }),
        },
      );

      const result = await detectProject(
        reader,
        "example",
        "node-app",
      );

      expect(result.framework).toBe(framework);
    },
  );

  it.each([
    ["pnpm", "pnpm-lock.yaml"],
    ["yarn", "yarn.lock"],
    ["bun", "bun.lock"],
    ["bun", "bun.lockb"],
    ["npm", "package-lock.json"],
  ] as const)(
    "detects the %s package manager from %s",
    async (packageManager, lockfile) => {
      const reader = new FakeRepositoryReader(
        ["package.json", lockfile],
        {
          "package.json": JSON.stringify({}),
        },
      );

      const result = await detectProject(
        reader,
        "example",
        "node-app",
      );

      expect(result.packageManager).toBe(
        packageManager,
      );
      expect(result.lockfilePresent).toBe(true);
    },
  );

  it.each([
    ["an unreadable package.json", undefined],
    ["an invalid package.json", "{invalid-json"],
  ])(
    "uses safe Node defaults for %s",
    async (_description, packageJson) => {
      const files = packageJson === undefined
        ? {}
        : { "package.json": packageJson };

      const reader = new FakeRepositoryReader(
        ["package.json"],
        files,
      );

      const result = await detectProject(
        reader,
        "example",
        "node-app",
      );

      expect(result).toMatchObject({
        projectType: "node",
        framework: "Node.js",
        packageManager: "npm",
        lockfilePresent: false,
        availableScripts: [],
      });
    },
  );

  it("detects a generic pyproject.toml as a pip project", async () => {
    const reader = new FakeRepositoryReader(
      [
        "pyproject.toml",
        "src",
        "README.md",
      ],
      {
        "pyproject.toml": `
[project]
name = "example"
dependencies = []
`,
      },
    );

    const result = await detectProject(
      reader,
      "example",
      "python-app",
    );

    expect(result).toMatchObject({
      projectType: "python",
      framework: "Python",
      language: "Python",
      packageManager: null,
      python: {
        packageManager: "pip",
        dependencySource: "project",
        lockfilePresent: false,
        availableTasks: {
          ruff: false,
          pytest: false,
          mypy: false,
          build: false,
        },
      },
    });

    expect(result.signals).toContain(
      "pyproject.toml",
    );
  });

  it.each([
    {
      description: "requirements.txt",
      rootEntries: ["requirements.txt"],
      files: {
        "requirements.txt": "ruff==0.12.0\npytest-cov==6.0.0",
      },
      packageManager: "pip",
      dependencySource: "requirements",
      lockfilePresent: false,
    },
    {
      description: "requirements-dev.txt",
      rootEntries: ["requirements-dev.txt"],
      files: {
        "requirements-dev.txt": "pytest>=8\n",
      },
      packageManager: "pip",
      dependencySource: "requirements-dev",
      lockfilePresent: false,
    },
    {
      description: "requirements_dev.txt",
      rootEntries: ["requirements_dev.txt"],
      files: {
        "requirements_dev.txt": "mypy>=1.16\n",
      },
      packageManager: "pip",
      dependencySource: "requirements_dev",
      lockfilePresent: false,
    },
    {
      description: "uv.lock",
      rootEntries: ["pyproject.toml", "uv.lock"],
      files: {
        "pyproject.toml": "[project]\nname = \"uv-app\"",
      },
      packageManager: "uv",
      dependencySource: "project",
      lockfilePresent: true,
    },
    {
      description: "poetry.lock",
      rootEntries: ["pyproject.toml", "poetry.lock"],
      files: {
        "pyproject.toml": "[tool.poetry]\nname = \"poetry-app\"",
      },
      packageManager: "poetry",
      dependencySource: "project",
      lockfilePresent: true,
    },
    {
      description: "Pipfile",
      rootEntries: ["Pipfile"],
      files: {
        Pipfile: "[packages]\nrequests = \"*\"",
      },
      packageManager: "pipenv",
      dependencySource: "pipfile",
      lockfilePresent: false,
    },
    {
      description: "Pipfile.lock",
      rootEntries: ["Pipfile.lock"],
      files: {},
      packageManager: "pipenv",
      dependencySource: "pipfile",
      lockfilePresent: true,
    },
  ] as const)(
    "detects Python package metadata from $description",
    async ({
      rootEntries,
      files,
      packageManager,
      dependencySource,
      lockfilePresent,
    }) => {
      const result = await detectProject(
        new FakeRepositoryReader(
          [...rootEntries],
          files,
        ),
        "example",
        "python-app",
      );

      expect(result.projectType).toBe("python");
      expect(result.python).toMatchObject({
        packageManager,
        dependencySource,
        lockfilePresent,
      });
      expect(result.lockfilePresent).toBe(false);
    },
  );

  it("discovers Python tasks from exact pyproject metadata", async () => {
    const result = await detectProject(
      new FakeRepositoryReader(
        ["pyproject.toml"],
        {
          "pyproject.toml": `
[build-system]
requires = ["setuptools>=75"]

[project]
name = "quality-app"
dependencies = [
  "ruff>=0.12",
  "pytest-cov>=6",
]

[project.optional-dependencies]
test = ["pytest>=8", "mypy==1.16"]
`,
        },
      ),
      "example",
      "quality-app",
    );

    expect(result.python?.availableTasks).toEqual({
      ruff: true,
      pytest: true,
      mypy: true,
      build: true,
    });
  });

  it("discovers Python tasks from root tool markers and setup.py", async () => {
    const result = await detectProject(
      new FakeRepositoryReader([
        "setup.py",
        "ruff.toml",
        "pytest.ini",
        "mypy.ini",
      ]),
      "example",
      "configured-app",
    );

    expect(result.python).toMatchObject({
      packageManager: "pip",
      dependencySource: "project",
      availableTasks: {
        ruff: true,
        pytest: true,
        mypy: true,
        build: true,
      },
    });
  });

  it("detects Poetry without a lockfile from an exact TOML section", async () => {
    const result = await detectProject(
      new FakeRepositoryReader(
        ["pyproject.toml"],
        {
          "pyproject.toml": `
[tool.poetry]
name = "poetry-app"

[tool.poetry.group.dev.dependencies]
pytest = "^8.0"
`,
        },
      ),
      "example",
      "poetry-app",
    );

    expect(result.python).toMatchObject({
      packageManager: "poetry",
      dependencySource: "project",
      lockfilePresent: false,
      availableTasks: {
        pytest: true,
      },
    });
  });

  it("detects uv without a lockfile from an exact TOML table", async () => {
    const result = await detectProject(
      new FakeRepositoryReader(
        ["pyproject.toml"],
        {
          "pyproject.toml": "[tool.uv]\ndefault-groups = [\"dev\"]",
        },
      ),
      "example",
      "uv-app",
    );

    expect(result.python).toMatchObject({
      packageManager: "uv",
      dependencySource: "project",
      lockfilePresent: false,
    });
  });

  it("uses deterministic Python package manager precedence", async () => {
    const result = await detectProject(
      new FakeRepositoryReader(
        [
          "pyproject.toml",
          "uv.lock",
          "poetry.lock",
          "Pipfile",
          "Pipfile.lock",
        ],
        {
          "pyproject.toml": "[tool.poetry]\nname = \"mixed\"",
          Pipfile: "[packages]",
        },
      ),
      "example",
      "mixed-python-app",
    );

    expect(result.python).toMatchObject({
      packageManager: "uv",
      dependencySource: "project",
      lockfilePresent: true,
    });
  });

  it("falls back safely when pyproject.toml cannot be parsed", async () => {
    const result = await detectProject(
      new FakeRepositoryReader(
        ["pyproject.toml"],
        {
          "pyproject.toml": "[tool.poetry\ninvalid = [",
        },
      ),
      "example",
      "broken-python-app",
    );

    expect(result.python).toEqual({
      packageManager: "pip",
      dependencySource: "project",
      lockfilePresent: false,
      availableTasks: {
        ruff: false,
        pytest: false,
        mypy: false,
        build: false,
      },
    });
  });

  it("does not discover tools from similar dependency names or TOML strings", async () => {
    const result = await detectProject(
      new FakeRepositoryReader(
        ["pyproject.toml"],
        {
          "pyproject.toml": `
[project]
name = "safe-app"
description = """
[tool.poetry]
"""
dependencies = ["pytest-cov", "ruff-lsp", "mypy-extensions"]
`,
        },
      ),
      "example",
      "safe-app",
    );

    expect(result.python).toEqual({
      packageManager: "pip",
      dependencySource: "project",
      lockfilePresent: false,
      availableTasks: {
        ruff: false,
        pytest: false,
        mypy: false,
        build: false,
      },
    });
  });

  it("does not treat scalar TOML keys as tool configuration tables", async () => {
    const result = await detectProject(
      new FakeRepositoryReader(
        ["pyproject.toml"],
        {
          "pyproject.toml": `
build-system = "documentation label"

[tool]
poetry = "documentation"
uv = false
ruff = false
mypy = "configuration example"
pytest = { ini_options = "not a table" }
`,
        },
      ),
      "example",
      "scalar-values",
    );

    expect(result.python).toEqual({
      packageManager: "pip",
      dependencySource: "project",
      lockfilePresent: false,
      availableTasks: {
        ruff: false,
        pytest: false,
        mypy: false,
        build: false,
      },
    });
  });

  it("keeps Flutter then Node precedence over Python markers", async () => {
    const flutter = await detectProject(
      new FakeRepositoryReader(
        ["pubspec.yaml", "package.json", "pyproject.toml"],
        {
          "pubspec.yaml": "dependencies:\n  flutter:\n    sdk: flutter",
          "package.json": "{}",
          "pyproject.toml": "[project]",
        },
      ),
      "example",
      "flutter-monorepo",
    );
    const node = await detectProject(
      new FakeRepositoryReader(
        ["package.json", "pyproject.toml"],
        {
          "package.json": "{}",
          "pyproject.toml": "[project]",
        },
      ),
      "example",
      "node-monorepo",
    );

    expect(flutter.projectType).toBe("flutter");
    expect(node.projectType).toBe("node");
  });

  it("detects existing GitHub Actions workflows", async () => {
    const reader = new FakeRepositoryReader(
      [
        "pubspec.yaml",
        "android",
        "ios",
      ],
      {
        "pubspec.yaml": `
dependencies:
  flutter:
    sdk: flutter
`,
      },
      [
        ".github/workflows",
      ],
    );

    const result = await detectProject(
      reader,
      "example",
      "flutter-ci-app",
    );

    expect(result.ciConfigured).toBe(
      true,
    );
  });

  it("returns unknown when no supported project markers exist", async () => {
    const reader = new FakeRepositoryReader([
      "README.md",
      "LICENSE",
      "docs",
    ]);

    const result = await detectProject(
      reader,
      "example",
      "unknown-project",
    );

    expect(result).toEqual({
      projectType: "unknown",
      framework: null,
      language: null,
      packageManager: null,
      lockfilePresent: false,
      availableScripts: [],
      python: null,

      platforms: {
        android: false,
        ios: false,
        web: false,
      },

      ciConfigured: false,
      signals: [],
    });
  });

  it("returns independent platform state for separate analyses", async () => {
    const reader = new FakeRepositoryReader([
      "README.md",
    ]);

    const first = await detectProject(
      reader,
      "example",
      "first-project",
    );

    const second = await detectProject(
      reader,
      "example",
      "second-project",
    );

    expect(first.platforms).not.toBe(
      second.platforms,
    );

    first.platforms.android = true;

    expect(second.platforms.android).toBe(
      false,
    );
  });
});
