import { useState } from "react";
import {
  CheckCircle2,
  Code2,
  Loader2,
  Play,
  Save,
  Smartphone,
} from "lucide-react";

import type {
  FlutterPipelineConfig,
} from "@homemade-cicd/core";

import { api } from "../lib/api";

interface PipelineBuilderProps {
  owner: string;
  repo: string;
  defaultBranch: string;
}

export function PipelineBuilder({
  owner,
  repo,
  defaultBranch,
}: PipelineBuilderProps) {
  const [config, setConfig] =
    useState<FlutterPipelineConfig>({
      branch: defaultBranch,

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
        aab: true,
      },

      ios: {
        enabled: true,
        unsignedBuild: true,
      },
    });

  const [preview, setPreview] =
    useState<string | null>(null);

  const [isPreviewing, setIsPreviewing] =
    useState(false);

  const [isSaving, setIsSaving] =
    useState(false);

  const [success, setSuccess] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  async function previewPipeline() {
    setError(null);
    setSuccess(null);
    setIsPreviewing(true);

    try {
      const result =
        await api.github.previewFlutterPipeline(
          owner,
          repo,
          config,
        );

      setPreview(result.yaml);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Pipeline preview failed.",
      );
    } finally {
      setIsPreviewing(false);
    }
  }

  async function createPipeline() {
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const result =
        await api.github.applyFlutterPipeline(
          owner,
          repo,
          config,
        );

      setSuccess(
        result.workflow.created
          ? "Pipeline created successfully."
          : "Pipeline updated successfully.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
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

        <h3 className="mt-1 text-xl font-semibold">
          Flutter CI/CD
        </h3>

        <p className="mt-2 text-sm text-zinc-500">
          {owner}/{repo}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-4 flex items-center gap-2">
              <Code2 size={17} />

              <span className="font-medium">
                Quality checks
              </span>
            </div>

            <Checkbox
              label="Flutter analyze"
              checked={config.checks.analyze}
              onChange={(value) =>
                setConfig((current) => ({
                  ...current,
                  checks: {
                    ...current.checks,
                    analyze: value,
                  },
                }))
              }
            />

            <Checkbox
              label="Flutter tests"
              checked={config.checks.test}
              onChange={(value) =>
                setConfig((current) => ({
                  ...current,
                  checks: {
                    ...current.checks,
                    test: value,
                  },
                }))
              }
            />
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-4 flex items-center gap-2">
              <Smartphone size={17} />

              <span className="font-medium">
                Android
              </span>
            </div>

            <Checkbox
              label="Enable Android build"
              checked={config.android.enabled}
              onChange={(value) =>
                setConfig((current) => ({
                  ...current,
                  android: {
                    ...current.android,
                    enabled: value,
                  },
                }))
              }
            />

            <Checkbox
              label="Build APK"
              checked={config.android.apk}
              disabled={!config.android.enabled}
              onChange={(value) =>
                setConfig((current) => ({
                  ...current,
                  android: {
                    ...current.android,
                    apk: value,
                  },
                }))
              }
            />

            <Checkbox
              label="Build AAB"
              checked={config.android.aab}
              disabled={!config.android.enabled}
              onChange={(value) =>
                setConfig((current) => ({
                  ...current,
                  android: {
                    ...current.android,
                    aab: value,
                  },
                }))
              }
            />
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-4 flex items-center gap-2">
              <Smartphone size={17} />

              <span className="font-medium">
                iOS
              </span>
            </div>

            <Checkbox
              label="Enable iOS build"
              checked={config.ios.enabled}
              onChange={(value) =>
                setConfig((current) => ({
                  ...current,
                  ios: {
                    ...current.ios,
                    enabled: value,
                  },
                }))
              }
            />

            <Checkbox
              label="Unsigned iOS build"
              checked={config.ios.unsignedBuild}
              disabled={!config.ios.enabled}
              onChange={(value) =>
                setConfig((current) => ({
                  ...current,
                  ios: {
                    ...current.ios,
                    unsignedBuild: value,
                  },
                }))
              }
            />
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-4 flex items-center gap-2">
              <Play size={17} />

              <span className="font-medium">
                Triggers
              </span>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs text-zinc-500">
                Branch
              </label>

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
            </div>

            <Checkbox
              label="Push to branch"
              checked={config.trigger.push}
              onChange={(value) =>
                setConfig((current) => ({
                  ...current,
                  trigger: {
                    ...current.trigger,
                    push: value,
                  },
                }))
              }
            />

            <Checkbox
              label="Pull request"
              checked={
                config.trigger.pullRequest
              }
              onChange={(value) =>
                setConfig((current) => ({
                  ...current,
                  trigger: {
                    ...current.trigger,
                    pullRequest: value,
                  },
                }))
              }
            />

            <Checkbox
              label="Manual run"
              checked={config.trigger.manual}
              onChange={(value) =>
                setConfig((current) => ({
                  ...current,
                  trigger: {
                    ...current.trigger,
                    manual: value,
                  },
                }))
              }
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={previewPipeline}
              disabled={isPreviewing}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-700 text-sm hover:bg-zinc-900 disabled:opacity-50"
            >
              {isPreviewing ? (
                <Loader2
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <Code2 size={16} />
              )}

              Preview
            </button>

            <button
              type="button"
              onClick={createPipeline}
              disabled={isSaving}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-100 text-sm font-medium text-zinc-950 hover:bg-white disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <Save size={16} />
              )}

              Create Pipeline
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

function Checkbox({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={`mb-3 flex items-center gap-3 text-sm ${
        disabled
          ? "cursor-not-allowed text-zinc-600"
          : "cursor-pointer text-zinc-300"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.checked)
        }
        className="h-4 w-4"
      />

      {label}
    </label>
  );
}