import type {
  ProjectAnalysis,
} from "@homemade-cicd/core";

import {
  inspectPythonProject,
  PYTHON_PROJECT_MARKERS,
  PYTHON_TOOL_MARKERS,
} from "./python-project-metadata.js";
import type {
  RepositoryReader,
} from "./repositories/repository-reader.js";

function createNoPlatforms(): ProjectAnalysis["platforms"] {
  return {
    android: false,
    ios: false,
    web: false,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

interface NodePackageMetadata {
  framework: string;
  availableScripts: string[];
}

function readAvailableScripts(
  packageJson: Record<string, unknown>,
): string[] {
  const scripts = asRecord(packageJson.scripts);

  return Object.entries(scripts)
    .filter((entry): entry is [string, string] =>
      typeof entry[1] === "string",
    )
    .map(([name]) => name)
    .sort();
}

function inspectNodePackageJson(
  packageJsonText: string,
): NodePackageMetadata {
  try {
    const packageJson = asRecord(
      JSON.parse(packageJsonText) as unknown,
    );
    const availableScripts =
      readAvailableScripts(packageJson);
    const dependencies = {
      ...asRecord(packageJson.dependencies),
      ...asRecord(packageJson.devDependencies),
    };

    if ("next" in dependencies) {
      return {
        framework: "Next.js",
        availableScripts,
      };
    }

    if ("@nestjs/core" in dependencies) {
      return {
        framework: "NestJS",
        availableScripts,
      };
    }

    if ("fastify" in dependencies) {
      return {
        framework: "Fastify",
        availableScripts,
      };
    }

    if ("express" in dependencies) {
      return {
        framework: "Express",
        availableScripts,
      };
    }

    if (
      "react" in dependencies &&
      "vite" in dependencies
    ) {
      return {
        framework: "React + Vite",
        availableScripts,
      };
    }

    if ("react" in dependencies) {
      return {
        framework: "React",
        availableScripts,
      };
    }

    return {
      framework: "Node.js",
      availableScripts,
    };
  } catch {
    return {
      framework: "Node.js",
      availableScripts: [],
    };
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
  reader: RepositoryReader,
  owner: string,
  repo: string,
): Promise<ProjectAnalysis> {
  const names = await reader.listRootEntryNames(
    owner,
    repo,
  );
  const hasPubspec = names.has("pubspec.yaml");
  const hasPackageJson = names.has("package.json");
  const pythonSignals = PYTHON_PROJECT_MARKERS.filter(
    (file) => names.has(file),
  );
  const hasPythonProject = pythonSignals.length > 0;
  const android = names.has("android");
  const ios = names.has("ios");
  const web = names.has("web");
  const workflowsExist = await reader.pathExists(
    owner,
    repo,
    ".github/workflows",
  );

  if (hasPubspec) {
    const pubspec = await reader.readTextFile(
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
        lockfilePresent: false,
        availableScripts: [],
        python: null,
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

  if (hasPackageJson) {
    const packageJson = await reader.readTextFile(
      owner,
      repo,
      "package.json",
    );
    const detectedPackageManager =
      detectPackageManager(names);
    const packageMetadata = packageJson
      ? inspectNodePackageJson(packageJson)
      : {
          framework: "Node.js",
          availableScripts: [],
        };

    return {
      projectType: "node",
      framework: packageMetadata.framework,
      language: "TypeScript / JavaScript",
      packageManager: detectedPackageManager ?? "npm",
      lockfilePresent: detectedPackageManager !== null,
      availableScripts: packageMetadata.availableScripts,
      python: null,
      platforms: {
        android: false,
        ios: false,
        web: true,
      },
      ciConfigured: workflowsExist,
      signals: [
        "package.json",
        ...(detectedPackageManager
          ? [`${detectedPackageManager} lockfile`]
          : []),
      ],
    };
  }

  if (hasPythonProject) {
    const python = await inspectPythonProject(
      reader,
      owner,
      repo,
      names,
    );

    return {
      projectType: "python",
      framework: "Python",
      language: "Python",
      packageManager: null,
      lockfilePresent: false,
      availableScripts: [],
      python,
      platforms: createNoPlatforms(),
      ciConfigured: workflowsExist,
      signals: [
        ...pythonSignals,
        ...PYTHON_TOOL_MARKERS.filter((file) => names.has(file)),
      ],
    };
  }

  return {
    projectType: "unknown",
    framework: null,
    language: null,
    packageManager: null,
    lockfilePresent: false,
    availableScripts: [],
    python: null,
    platforms: createNoPlatforms(),
    ciConfigured: workflowsExist,
    signals: [],
  };
}
