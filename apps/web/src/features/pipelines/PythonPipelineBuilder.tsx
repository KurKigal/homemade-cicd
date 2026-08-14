import { useState } from "react";
import type { ReactNode } from "react";

import {
  CheckCircle2,
  Code2,
  Loader2,
  PackageCheck,
  Play,
  Save,
  TerminalSquare,
} from "lucide-react";

import type {
  PythonDependencySource,
  PythonPackageManager,
  PythonPipelineConfig,
  PythonTasks,
} from "@homemade-cicd/core";

import { api } from "../../lib/api";

type PythonTask = keyof PythonPipelineConfig["tasks"];

interface PythonPipelineBuilderProps {
  owner: string;
  repo: string;
  defaultBranch: string;
  packageManager: PythonPackageManager;
  dependencySource: PythonDependencySource;
  availableTasks: PythonTasks;
  lockfilePresent: boolean;
  initialConfig?: PythonPipelineConfig;
  mode?: "create" | "edit";
  onApplied?: () => void;
  metadataWarning?: string;
}

const DEPENDENCY_SOURCES: Array<{
  value: PythonDependencySource;
  label: string;
}> = [
  { value: "requirements", label: "requirements.txt" },
  { value: "requirements-dev", label: "requirements-dev.txt" },
  { value: "requirements_dev", label: "requirements_dev.txt" },
  { value: "project", label: "Python project" },
  { value: "pipfile", label: "Pipfile" },
];

const TASKS: Array<{
  key: PythonTask;
  label: string;
  hint: string;
}> = [
  { key: "ruff", label: "Ruff", hint: "Runs ruff check ." },
  { key: "pytest", label: "Pytest", hint: "Runs pytest." },
  { key: "mypy", label: "Mypy", hint: "Runs mypy ." },
  {
    key: "build",
    label: "Package build",
    hint: "Builds the Python package and uploads dist/*.",
  },
];

function defaultDependencySource(
  nextPackageManager: PythonPackageManager,
  detectedPackageManager: PythonPackageManager,
  detectedDependencySource: PythonDependencySource,
  initialConfig: PythonPipelineConfig | undefined,
): PythonDependencySource {
  if (nextPackageManager === detectedPackageManager) {
    return detectedDependencySource;
  }

  if (initialConfig?.packageManager === nextPackageManager) {
    return initialConfig.dependencySource;
  }

  return nextPackageManager === "pipenv"
    ? "pipfile"
    : "project";
}

function packageManagerOptions(
  detectedPackageManager: PythonPackageManager,
  initialConfig: PythonPipelineConfig | undefined,
): PythonPackageManager[] {
  return Array.from(new Set([
    detectedPackageManager,
    ...(initialConfig
      ? [initialConfig.packageManager]
      : []),
  ]));
}

function dependencySourceOptions(
  packageManager: PythonPackageManager,
  detectedPackageManager: PythonPackageManager,
  detectedDependencySource: PythonDependencySource,
  initialConfig: PythonPipelineConfig | undefined,
): PythonDependencySource[] {
  const sources: PythonDependencySource[] = [];

  if (packageManager === detectedPackageManager) {
    sources.push(detectedDependencySource);
  }

  if (initialConfig?.packageManager === packageManager) {
    sources.push(initialConfig.dependencySource);
  }

  return Array.from(new Set(sources));
}

function createDefaultConfig(
  branch: string,
  packageManager: PythonPackageManager,
  dependencySource: PythonDependencySource,
  availableTasks: PythonTasks,
  lockfilePresent: boolean,
): PythonPipelineConfig {
  return {
    branch,
    pythonVersion: "3.12",
    packageManager,
    dependencySource,
    frozenLockfile:
      packageManager !== "pip" && lockfilePresent,
    trigger: {
      push: true,
      pullRequest: true,
      manual: true,
    },
    tasks: {
      ...availableTasks,
    },
  };
}

export function PythonPipelineBuilder(
  props: PythonPipelineBuilderProps,
) {
  const resetKey = JSON.stringify({
    owner: props.owner,
    repo: props.repo,
    defaultBranch: props.defaultBranch,
    packageManager: props.packageManager,
    dependencySource: props.dependencySource,
    availableTasks: props.availableTasks,
    lockfilePresent: props.lockfilePresent,
    initialConfig: props.initialConfig,
  });

  return <PythonPipelineBuilderForm key={resetKey} {...props} />;
}

function PythonPipelineBuilderForm({
  owner,
  repo,
  defaultBranch,
  packageManager,
  dependencySource,
  availableTasks,
  lockfilePresent,
  initialConfig,
  mode = "create",
  onApplied,
  metadataWarning,
}: PythonPipelineBuilderProps) {
  const [config, setConfig] = useState<PythonPipelineConfig>(() =>
    initialConfig ??
    createDefaultConfig(
      defaultBranch,
      packageManager,
      dependencySource,
      availableTasks,
      lockfilePresent,
    ),
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const compatibleLockfile =
    config.packageManager !== "pip" &&
    lockfilePresent &&
    config.packageManager === packageManager;
  const canSubmit =
    config.branch.trim().length > 0 &&
    config.pythonVersion.trim().length > 0;
  const selectablePackageManagers = packageManagerOptions(
    packageManager,
    initialConfig,
  );
  const selectableDependencySources = dependencySourceOptions(
    config.packageManager,
    packageManager,
    dependencySource,
    initialConfig,
  );

  async function previewPipeline() {
    setError(null);
    setSuccess(null);
    setIsPreviewing(true);

    try {
      const result = await api.github.previewPipeline(owner, repo, {
        projectType: "python",
        config,
      });

      setPreview(result.yaml);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Pipeline preview failed.",
      );
    } finally {
      setIsPreviewing(false);
    }
  }

  async function savePipeline() {
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const result = await api.github.applyPipeline(owner, repo, {
        projectType: "python",
        config,
      });

      setSuccess(
        result.workflow.created
          ? "Pipeline created successfully."
          : "Pipeline updated successfully.",
      );
      onApplied?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === "edit"
            ? "Pipeline update failed."
            : "Pipeline creation failed.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          Pipeline builder
        </p>
        <h3 className="mt-1 text-xl font-semibold">Python CI/CD</h3>
        <p className="mt-2 text-sm text-zinc-500">
          {owner}/{repo}
        </p>

        {mode === "edit" && (
          <p className="mt-2 text-xs text-zinc-600">
            Editing existing Homemade CI/CD pipeline
          </p>
        )}

        {metadataWarning && (
          <p className="mt-3 rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-xs leading-5 text-amber-300">
            {metadataWarning}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-4 flex items-center gap-2">
              <PackageCheck size={17} />
              <span className="font-medium">Runtime and dependencies</span>
            </div>

            <Field label="Python version">
              <input
                value={config.pythonVersion}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    pythonVersion: event.target.value,
                  }))
                }
                placeholder="3.12"
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
              />
            </Field>

            <Field label="Package manager">
              <select
                value={config.packageManager}
                onChange={(event) => {
                  const nextPackageManager =
                    event.target.value as PythonPackageManager;

                  setConfig((current) => ({
                    ...current,
                    packageManager: nextPackageManager,
                    dependencySource: defaultDependencySource(
                      nextPackageManager,
                      packageManager,
                      dependencySource,
                      initialConfig,
                    ),
                    frozenLockfile:
                      current.frozenLockfile &&
                      nextPackageManager !== "pip" &&
                      lockfilePresent &&
                      nextPackageManager === packageManager,
                  }));
                }}
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
              >
                {selectablePackageManagers.map((manager) => (
                  <option key={manager} value={manager}>
                    {manager}
                    {manager === packageManager
                      ? lockfilePresent
                        ? " (lockfile detected)"
                        : " (repository default)"
                      : manager === initialConfig?.packageManager
                        ? " (existing pipeline)"
                        : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Dependency source">
              <select
                value={config.dependencySource}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    dependencySource:
                      event.target.value as PythonDependencySource,
                  }))
                }
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
              >
                {DEPENDENCY_SOURCES.filter((source) =>
                  selectableDependencySources.includes(source.value),
                ).map((source) => (
                  <option key={source.value} value={source.value}>
                    {source.label}
                  </option>
                ))}
              </select>
            </Field>

            <Checkbox
              label="Use frozen lockfile install"
              checked={config.frozenLockfile}
              disabled={!compatibleLockfile && !config.frozenLockfile}
              hint={
                config.packageManager === "pip"
                  ? "Requirements files are dependency sources, not managed lockfiles."
                  : compatibleLockfile
                    ? `A ${config.packageManager} lockfile was detected.`
                    : config.frozenLockfile
                      ? "The configured package manager no longer has a matching detected lockfile."
                      : "No matching lockfile is available for this package manager."
              }
              onChange={(value) =>
                setConfig((current) => ({
                  ...current,
                  frozenLockfile: value,
                }))
              }
            />
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-4 flex items-center gap-2">
              <TerminalSquare size={17} />
              <span className="font-medium">Python tasks</span>
            </div>

            {TASKS.map((task) => {
              const available = availableTasks[task.key];

              return (
                <Checkbox
                  key={task.key}
                  label={task.label}
                  checked={config.tasks[task.key]}
                  disabled={!available && !config.tasks[task.key]}
                  hint={
                    available
                      ? task.hint
                      : config.tasks[task.key]
                        ? `${task.label} is no longer detected; keep or disable the existing task.`
                        : `${task.label} was not detected in this repository.`
                  }
                  onChange={(value) =>
                    setConfig((current) => ({
                      ...current,
                      tasks: {
                        ...current.tasks,
                        [task.key]: value,
                      },
                    }))
                  }
                />
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-4 flex items-center gap-2">
              <Play size={17} />
              <span className="font-medium">Triggers</span>
            </div>

            <Field label="Branch">
              <input
                value={config.branch}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    branch: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
              />
            </Field>

            <Checkbox
              label="Push to branch"
              checked={config.trigger.push}
              onChange={(value) =>
                setConfig((current) => ({
                  ...current,
                  trigger: { ...current.trigger, push: value },
                }))
              }
            />
            <Checkbox
              label="Pull request"
              checked={config.trigger.pullRequest}
              onChange={(value) =>
                setConfig((current) => ({
                  ...current,
                  trigger: { ...current.trigger, pullRequest: value },
                }))
              }
            />
            <Checkbox
              label="Manual run"
              checked={config.trigger.manual}
              onChange={(value) =>
                setConfig((current) => ({
                  ...current,
                  trigger: { ...current.trigger, manual: value },
                }))
              }
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={previewPipeline}
              disabled={isPreviewing || isSaving || !canSubmit}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-700 text-sm transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPreviewing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Code2 size={16} />
              )}
              Preview
            </button>

            <button
              type="button"
              onClick={savePipeline}
              disabled={isSaving || isPreviewing || !canSubmit}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-100 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {isSaving
                ? "Saving..."
                : mode === "edit"
                  ? "Update Pipeline"
                  : "Create Pipeline"}
            </button>
          </div>

          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-900 bg-emerald-950/30 p-3 text-sm text-emerald-300">
              <CheckCircle2 size={16} />
              {success}
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>

      {preview && (
        <div className="mt-6">
          <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
            Generated workflow
          </p>
          <pre className="max-h-[500px] overflow-auto rounded-lg border border-zinc-800 bg-black p-4 text-xs leading-6 text-zinc-300">
            {preview}
          </pre>
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function Checkbox({
  label,
  checked,
  disabled = false,
  hint,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  hint?: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={`mb-3 flex items-start gap-3 text-sm ${
        disabled
          ? "cursor-not-allowed text-zinc-600"
          : "cursor-pointer text-zinc-300"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4"
      />
      <span>
        <span className="block">{label}</span>
        {hint && <span className="mt-1 block text-xs text-zinc-600">{hint}</span>}
      </span>
    </label>
  );
}
