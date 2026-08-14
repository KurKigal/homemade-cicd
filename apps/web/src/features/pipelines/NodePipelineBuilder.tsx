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
  NodePipelineConfig,
  PackageManager,
} from "@homemade-cicd/core";

import { api } from "../../lib/api";

type NodeTask = keyof NodePipelineConfig["tasks"];

interface NodePipelineBuilderProps {
  owner: string;
  repo: string;
  defaultBranch: string;
  packageManager: PackageManager | null;
  availableScripts: string[];
  lockfilePresent: boolean;
  initialConfig?: NodePipelineConfig;
  mode?: "create" | "edit";
  onApplied?: () => void;
  metadataWarning?: string;
}

const PACKAGE_MANAGERS: PackageManager[] = [
  "npm",
  "pnpm",
  "yarn",
  "bun",
];

const TASKS: Array<{
  key: NodeTask;
  label: string;
  script: string;
}> = [
  { key: "lint", label: "Lint", script: "lint" },
  { key: "typecheck", label: "Typecheck", script: "typecheck" },
  { key: "test", label: "Tests", script: "test" },
  { key: "build", label: "Build", script: "build" },
];

function createDefaultConfig(
  branch: string,
  detectedPackageManager: PackageManager | null,
  availableScripts: string[],
  lockfilePresent: boolean,
): NodePipelineConfig {
  const scripts = new Set(availableScripts);

  return {
    branch,
    nodeVersion: "24",
    packageManager: detectedPackageManager ?? "npm",
    frozenLockfile:
      lockfilePresent && detectedPackageManager !== null,
    trigger: {
      push: true,
      pullRequest: true,
      manual: true,
    },
    tasks: {
      lint: scripts.has("lint"),
      typecheck: scripts.has("typecheck"),
      test: scripts.has("test"),
      build: scripts.has("build"),
    },
  };
}

export function NodePipelineBuilder(props: NodePipelineBuilderProps) {
  const resetKey = JSON.stringify({
    owner: props.owner,
    repo: props.repo,
    defaultBranch: props.defaultBranch,
    packageManager: props.packageManager,
    availableScripts: props.availableScripts,
    lockfilePresent: props.lockfilePresent,
    initialConfig: props.initialConfig,
  });

  return <NodePipelineBuilderForm key={resetKey} {...props} />;
}

function NodePipelineBuilderForm({
  owner,
  repo,
  defaultBranch,
  packageManager,
  availableScripts,
  lockfilePresent,
  initialConfig,
  mode = "create",
  onApplied,
  metadataWarning,
}: NodePipelineBuilderProps) {
  const [config, setConfig] = useState<NodePipelineConfig>(() => {
    return (
      initialConfig ??
      createDefaultConfig(
        defaultBranch,
        packageManager,
        availableScripts,
        lockfilePresent,
      )
    );
  });
  const [preview, setPreview] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scripts = new Set(availableScripts);
  const compatibleLockfile =
    lockfilePresent && config.packageManager === packageManager;
  const canSubmit =
    config.branch.trim().length > 0 &&
    config.nodeVersion.trim().length > 0;

  async function previewPipeline() {
    setError(null);
    setSuccess(null);
    setIsPreviewing(true);

    try {
      const result = await api.github.previewPipeline(owner, repo, {
        projectType: "node",
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
        projectType: "node",
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
        <h3 className="mt-1 text-xl font-semibold">Node.js CI/CD</h3>
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

            <Field label="Node.js version">
              <input
                value={config.nodeVersion}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    nodeVersion: event.target.value,
                  }))
                }
                placeholder="24"
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
              />
            </Field>

            <Field label="Package manager">
              <select
                value={config.packageManager}
                onChange={(event) => {
                  const nextPackageManager =
                    event.target.value as PackageManager;

                  setConfig((current) => ({
                    ...current,
                    packageManager: nextPackageManager,
                    frozenLockfile:
                      current.frozenLockfile &&
                      lockfilePresent &&
                      nextPackageManager === packageManager,
                  }));
                }}
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
              >
                {PACKAGE_MANAGERS.map((manager) => (
                  <option key={manager} value={manager}>
                    {manager}
                    {manager === packageManager
                      ? lockfilePresent
                        ? " (lockfile detected)"
                        : " (repository default)"
                      : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Checkbox
              label="Use frozen lockfile install"
              checked={config.frozenLockfile}
              disabled={
                !compatibleLockfile && !config.frozenLockfile
              }
              hint={
                compatibleLockfile
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
              <span className="font-medium">Package scripts</span>
            </div>

            {TASKS.map((task) => {
              const available = scripts.has(task.script);

              return (
                <Checkbox
                  key={task.key}
                  label={task.label}
                  checked={config.tasks[task.key]}
                  disabled={
                    !available && !config.tasks[task.key]
                  }
                  hint={
                    available
                      ? `Runs the ${task.script} package script.`
                      : config.tasks[task.key]
                        ? `The ${task.script} script is no longer detected; keep or disable the existing task.`
                        : `package.json has no ${task.script} script.`
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
