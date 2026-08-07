import { github } from "../lib/github.js";

export type ProjectType =
  | "flutter"
  | "node"
  | "python"
  | "unknown";

export interface ProjectAnalysis {
  projectType: ProjectType;
  framework: string | null;
  language: string | null;

  packageManager:
    | "pnpm"
    | "npm"
    | "yarn"
    | "bun"
    | null;

  platforms: {
    android: boolean;
    ios: boolean;
    web: boolean;
  };

  ciConfigured: boolean;
  signals: string[];
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 404
  );
}

async function getTextFile(
  owner: string,
  repo: string,
  path: string,
): Promise<string | null> {
  try {
    const { data } = await github.rest.repos.getContent({
      owner,
      repo,
      path,
    });

    if (Array.isArray(data) || data.type !== "file") {
      return null;
    }

    if (!("content" in data) || !data.content) {
      return null;
    }

    return Buffer.from(
      data.content.replace(/\n/g, ""),
      "base64",
    ).toString("utf8");
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }

    throw error;
  }
}

async function pathExists(
  owner: string,
  repo: string,
  path: string,
): Promise<boolean> {
  try {
    await github.rest.repos.getContent({
      owner,
      repo,
      path,
    });

    return true;
  } catch (error) {
    if (isNotFound(error)) {
      return false;
    }

    throw error;
  }
}

function detectNodeFramework(
  packageJsonText: string,
): string {
  try {
    const packageJson = JSON.parse(packageJsonText);

    const dependencies = {
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
    };

    if ("next" in dependencies) {
      return "Next.js";
    }

    if ("@nestjs/core" in dependencies) {
      return "NestJS";
    }

    if ("fastify" in dependencies) {
      return "Fastify";
    }

    if ("express" in dependencies) {
      return "Express";
    }

    if ("react" in dependencies && "vite" in dependencies) {
      return "React + Vite";
    }

    if ("react" in dependencies) {
      return "React";
    }

    return "Node.js";
  } catch {
    return "Node.js";
  }
}

function detectPackageManager(
  names: Set<string>,
): ProjectAnalysis["packageManager"] {
  if (names.has("pnpm-lock.yaml")) {
    return "pnpm";
  }

  if (names.has("yarn.lock")) {
    return "yarn";
  }

  if (
    names.has("bun.lock") ||
    names.has("bun.lockb")
  ) {
    return "bun";
  }

  if (names.has("package-lock.json")) {
    return "npm";
  }

  return null;
}

export async function detectProject(
  owner: string,
  repo: string,
): Promise<ProjectAnalysis> {
  const { data } = await github.rest.repos.getContent({
    owner,
    repo,
    path: "",
  });

  if (!Array.isArray(data)) {
    throw new Error(
      "Repository root could not be inspected.",
    );
  }

  const names = new Set(data.map((entry) => entry.name));

  const hasPubspec = names.has("pubspec.yaml");
  const hasPackageJson = names.has("package.json");

  const hasPythonProject =
    names.has("pyproject.toml") ||
    names.has("requirements.txt") ||
    names.has("Pipfile") ||
    names.has("setup.py");

  const android = names.has("android");
  const ios = names.has("ios");
  const web = names.has("web");

  const workflowsExist = await pathExists(
    owner,
    repo,
    ".github/workflows",
  );

  /*
   * FLUTTER
   */
  if (hasPubspec) {
    const pubspec = await getTextFile(
      owner,
      repo,
      "pubspec.yaml",
    );

    const isFlutter =
      pubspec?.includes("sdk: flutter") ||
      pubspec?.includes("flutter:");

    if (isFlutter) {
      const signals = ["pubspec.yaml"];

      if (android) {
        signals.push("android/");
      }

      if (ios) {
        signals.push("ios/");
      }

      if (web) {
        signals.push("web/");
      }

      return {
        projectType: "flutter",
        framework: "Flutter",
        language: "Dart",
        packageManager: null,

        platforms: {
          android,
          ios,
          web,
        },

        ciConfigured: workflowsExist,
        signals,
      };
    }
  }

  /*
   * NODE
   */
  if (hasPackageJson) {
    const packageJson = await getTextFile(
      owner,
      repo,
      "package.json",
    );

    return {
      projectType: "node",

      framework: packageJson
        ? detectNodeFramework(packageJson)
        : "Node.js",

      language: "TypeScript / JavaScript",

      packageManager: detectPackageManager(names),

      platforms: {
        android: false,
        ios: false,
        web: true,
      },

      ciConfigured: workflowsExist,

      signals: [
        "package.json",
        ...(detectPackageManager(names)
          ? [`${detectPackageManager(names)} lockfile`]
          : []),
      ],
    };
  }

  /*
   * PYTHON
   */
  if (hasPythonProject) {
    const signals: string[] = [];

    for (const file of [
      "pyproject.toml",
      "requirements.txt",
      "Pipfile",
      "setup.py",
    ]) {
      if (names.has(file)) {
        signals.push(file);
      }
    }

    return {
      projectType: "python",
      framework: "Python",
      language: "Python",
      packageManager: null,

      platforms: {
        android: false,
        ios: false,
        web: false,
      },

      ciConfigured: workflowsExist,
      signals,
    };
  }

  return {
    projectType: "unknown",
    framework: null,
    language: null,
    packageManager: null,

    platforms: {
      android: false,
      ios: false,
      web: false,
    },

    ciConfigured: workflowsExist,
    signals: [],
  };
}