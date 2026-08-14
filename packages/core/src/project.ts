import { z } from "zod";

export const projectTypeSchema = z.enum([
  "flutter",
  "node",
  "python",
  "unknown",
]);

export type ProjectType =
  z.infer<typeof projectTypeSchema>;

export const packageManagerSchema = z.enum([
  "pnpm",
  "npm",
  "yarn",
  "bun",
]);

export type PackageManager =
  z.infer<typeof packageManagerSchema>;

export const pythonPackageManagerSchema = z.enum([
  "pip",
  "uv",
  "poetry",
  "pipenv",
]);

export type PythonPackageManager =
  z.infer<typeof pythonPackageManagerSchema>;

export const pythonDependencySourceSchema = z.enum([
  "requirements",
  "requirements-dev",
  "requirements_dev",
  "project",
  "pipfile",
]);

export type PythonDependencySource =
  z.infer<typeof pythonDependencySourceSchema>;

export const pythonTasksSchema = z.object({
  ruff: z.boolean(),
  pytest: z.boolean(),
  mypy: z.boolean(),
  build: z.boolean(),
});

export type PythonTasks =
  z.infer<typeof pythonTasksSchema>;

export const pythonProjectMetadataSchema = z.object({
  packageManager: pythonPackageManagerSchema,
  dependencySource: pythonDependencySourceSchema,
  lockfilePresent: z.boolean(),
  availableTasks: pythonTasksSchema,
});

export type PythonProjectMetadata =
  z.infer<typeof pythonProjectMetadataSchema>;

export const projectAnalysisSchema = z.object({
  projectType: projectTypeSchema,

  framework: z.string().nullable(),
  language: z.string().nullable(),

  packageManager: packageManagerSchema.nullable(),

  lockfilePresent: z.boolean(),

  availableScripts: z.array(z.string()),

  python: pythonProjectMetadataSchema.nullable(),

  platforms: z.object({
    android: z.boolean(),
    ios: z.boolean(),
    web: z.boolean(),
  }),

  ciConfigured: z.boolean(),

  signals: z.array(z.string()),
});

export type ProjectAnalysis =
  z.infer<typeof projectAnalysisSchema>;

export const repositoryInspectionSchema = z.object({
  repository: z.object({
    owner: z.string(),
    name: z.string(),
  }),

  analysis: projectAnalysisSchema,
});

export type RepositoryInspection =
  z.infer<typeof repositoryInspectionSchema>;
