import {
  parse as parseToml,
} from "smol-toml";

import type {
  PythonDependencySource,
  PythonPackageManager,
  PythonProjectMetadata,
  PythonTasks,
} from "@homemade-cicd/core";

import type {
  RepositoryReader,
} from "./repositories/repository-reader.js";

export const PYTHON_PROJECT_MARKERS = [
  "pyproject.toml",
  "requirements.txt",
  "requirements-dev.txt",
  "requirements_dev.txt",
  "Pipfile",
  "setup.py",
  "uv.lock",
  "poetry.lock",
  "Pipfile.lock",
] as const;

export const PYTHON_TOOL_MARKERS = [
  "ruff.toml",
  ".ruff.toml",
  "pytest.ini",
  "conftest.py",
  "mypy.ini",
  ".mypy.ini",
] as const;

const PYTHON_METADATA_FILES = [
  "pyproject.toml",
  "requirements.txt",
  "requirements-dev.txt",
  "requirements_dev.txt",
  "Pipfile",
] as const;

type PythonMetadataFile =
  (typeof PYTHON_METADATA_FILES)[number];

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value)
    ? value
    : {};
}

function safeParseToml(text: string | undefined): UnknownRecord {
  if (!text) {
    return {};
  }

  try {
    return asRecord(parseToml(text));
  } catch {
    return {};
  }
}

function normalizeDistributionName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[-_.]+/gu, "-");
}

function readDistributionName(specifier: string): string | null {
  const match = /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)/u.exec(
    specifier,
  );

  return match?.[1]
    ? normalizeDistributionName(match[1])
    : null;
}

function addStringDependencies(
  target: Set<string>,
  value: unknown,
): void {
  if (!Array.isArray(value)) {
    return;
  }

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const dependency = readDistributionName(item);

    if (dependency) {
      target.add(dependency);
    }
  }
}

function addDependencyKeys(
  target: Set<string>,
  value: unknown,
): void {
  for (const name of Object.keys(asRecord(value))) {
    target.add(normalizeDistributionName(name));
  }
}

function collectPyprojectDependencies(
  pyproject: UnknownRecord,
): Set<string> {
  const dependencies = new Set<string>();
  const project = asRecord(pyproject.project);
  const optionalDependencies = asRecord(
    project["optional-dependencies"],
  );
  const tool = asRecord(pyproject.tool);
  const poetry = asRecord(tool.poetry);
  const poetryGroups = asRecord(poetry.group);
  const uv = asRecord(tool.uv);

  addStringDependencies(
    dependencies,
    project.dependencies,
  );

  for (const group of Object.values(optionalDependencies)) {
    addStringDependencies(dependencies, group);
  }

  addDependencyKeys(dependencies, poetry.dependencies);
  addDependencyKeys(
    dependencies,
    poetry["dev-dependencies"],
  );

  for (const group of Object.values(poetryGroups)) {
    addDependencyKeys(
      dependencies,
      asRecord(group).dependencies,
    );
  }

  addStringDependencies(
    dependencies,
    uv["dev-dependencies"],
  );

  for (const group of Object.values(
    asRecord(pyproject["dependency-groups"]),
  )) {
    addStringDependencies(dependencies, group);
  }

  return dependencies;
}

function collectRequirementsDependencies(
  text: string,
): Set<string> {
  const dependencies = new Set<string>();

  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.split("#", 1)[0]?.trim() ?? "";

    if (!line || line.startsWith("-")) {
      continue;
    }

    const dependency = readDistributionName(line);

    if (dependency) {
      dependencies.add(dependency);
    }
  }

  return dependencies;
}

function collectPipfileDependencies(
  pipfile: UnknownRecord,
): Set<string> {
  const dependencies = new Set<string>();

  addDependencyKeys(dependencies, pipfile.packages);
  addDependencyKeys(dependencies, pipfile["dev-packages"]);

  return dependencies;
}

function detectPythonPackageManager(
  names: Set<string>,
  pyproject: UnknownRecord,
): PythonPackageManager {
  if (names.has("uv.lock")) {
    return "uv";
  }

  if (names.has("poetry.lock")) {
    return "poetry";
  }

  if (
    names.has("Pipfile") ||
    names.has("Pipfile.lock")
  ) {
    return "pipenv";
  }

  const tool = asRecord(pyproject.tool);

  if (isRecord(tool.poetry)) {
    return "poetry";
  }

  if (isRecord(tool.uv)) {
    return "uv";
  }

  return "pip";
}

function detectPythonDependencySource(
  names: Set<string>,
  packageManager: PythonPackageManager,
): PythonDependencySource {
  if (packageManager === "pipenv") {
    return "pipfile";
  }

  if (
    packageManager === "uv" ||
    packageManager === "poetry"
  ) {
    return "project";
  }

  if (names.has("requirements.txt")) {
    return "requirements";
  }

  if (names.has("requirements-dev.txt")) {
    return "requirements-dev";
  }

  if (names.has("requirements_dev.txt")) {
    return "requirements_dev";
  }

  return "project";
}

function detectPythonTasks(
  names: Set<string>,
  files: Partial<Record<PythonMetadataFile, string>>,
  pyproject: UnknownRecord,
): PythonTasks {
  const dependencies = collectPyprojectDependencies(pyproject);

  for (const requirementsFile of [
    "requirements.txt",
    "requirements-dev.txt",
    "requirements_dev.txt",
  ] as const) {
    const contents = files[requirementsFile];

    if (!contents) {
      continue;
    }

    for (const dependency of collectRequirementsDependencies(contents)) {
      dependencies.add(dependency);
    }
  }

  const pipfile = safeParseToml(files.Pipfile);

  for (const dependency of collectPipfileDependencies(pipfile)) {
    dependencies.add(dependency);
  }

  const tool = asRecord(pyproject.tool);
  const pytest = asRecord(tool.pytest);

  return {
    ruff:
      names.has("ruff.toml") ||
      names.has(".ruff.toml") ||
      isRecord(tool.ruff) ||
      dependencies.has("ruff"),
    pytest:
      names.has("pytest.ini") ||
      names.has("conftest.py") ||
      isRecord(pytest.ini_options) ||
      dependencies.has("pytest"),
    mypy:
      names.has("mypy.ini") ||
      names.has(".mypy.ini") ||
      isRecord(tool.mypy) ||
      dependencies.has("mypy"),
    build:
      names.has("setup.py") ||
      isRecord(pyproject["build-system"]),
  };
}

export async function inspectPythonProject(
  reader: RepositoryReader,
  owner: string,
  repo: string,
  names: Set<string>,
): Promise<PythonProjectMetadata> {
  const existingMetadataFiles = PYTHON_METADATA_FILES.filter(
    (path) => names.has(path),
  );
  const entries = await Promise.all(
    existingMetadataFiles.map(async (path) => [
      path,
      await reader.readTextFile(owner, repo, path),
    ] as const),
  );
  const files: Partial<Record<PythonMetadataFile, string>> = {};

  for (const [path, contents] of entries) {
    if (contents !== null) {
      files[path] = contents;
    }
  }

  const pyproject = safeParseToml(files["pyproject.toml"]);
  const packageManager = detectPythonPackageManager(
    names,
    pyproject,
  );

  return {
    packageManager,
    dependencySource: detectPythonDependencySource(
      names,
      packageManager,
    ),
    lockfilePresent:
      (packageManager === "uv" && names.has("uv.lock")) ||
      (packageManager === "poetry" && names.has("poetry.lock")) ||
      (packageManager === "pipenv" && names.has("Pipfile.lock")),
    availableTasks: detectPythonTasks(
      names,
      files,
      pyproject,
    ),
  };
}
