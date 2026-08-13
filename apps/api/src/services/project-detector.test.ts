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

  it("detects React + Vite and pnpm", async () => {
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

  it("detects a Python project from pyproject.toml", async () => {
    const reader = new FakeRepositoryReader([
      "pyproject.toml",
      "src",
      "README.md",
    ]);

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
    });

    expect(result.signals).toContain(
      "pyproject.toml",
    );
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
