import { useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Loader2,
  Play,
  Save,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import {
  iosBundleIdSchema,
  iosTeamIdSchema,
  type FlutterPipelineConfig,
} from "@homemade-cicd/core";

import { api } from "../../lib/api";
import { SigningCredentialsPanel } from "../signing/SigningCredentialsPanel";
import {
  DISABLED_ANDROID_SIGNING,
  DISABLED_SIGNED_IPA,
  normalizeFlutterSigningConfig,
} from "../signing/flutter-signing-config";
import { useSigningStatus } from "../signing/useSigningStatus";

interface PipelineBuilderProps {
  owner: string;
  repo: string;
  defaultBranch: string;
  initialConfig?: FlutterPipelineConfig;
  mode?: "create" | "edit";
  onApplied?: () => void;
}

type SignedIpaConfig = NonNullable<FlutterPipelineConfig["ios"]["signedIpa"]>;
type IosExportMethod = SignedIpaConfig["exportMethod"];

const IOS_EXPORT_METHODS: Array<{
  value: IosExportMethod;
  label: string;
}> = [
  { value: "app-store", label: "App Store" },
  { value: "ad-hoc", label: "Ad hoc" },
  { value: "development", label: "Development" },
];

function createDefaultConfig(branch: string): FlutterPipelineConfig {
  return {
    branch,
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
      signing: DISABLED_ANDROID_SIGNING,
    },
    ios: {
      enabled: true,
      unsignedBuild: true,
      signedIpa: DISABLED_SIGNED_IPA,
    },
  };
}

export function PipelineBuilder(props: PipelineBuilderProps) {
  const resetKey = JSON.stringify({
    owner: props.owner,
    repo: props.repo,
    defaultBranch: props.defaultBranch,
    initialConfig: props.initialConfig,
  });

  return <PipelineBuilderForm key={resetKey} {...props} />;
}

function PipelineBuilderForm({
  owner,
  repo,
  defaultBranch,
  initialConfig,
  mode = "create",
  onApplied,
}: PipelineBuilderProps) {
  const [config, setConfig] = useState<FlutterPipelineConfig>(() =>
    normalizeFlutterSigningConfig(
      initialConfig ?? createDefaultConfig(defaultBranch),
    ),
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signingQuery = useSigningStatus(owner, repo);

  const androidSigningEnabled = config.android.signing?.enabled === true;
  const signedIpa = config.ios.signedIpa ?? DISABLED_SIGNED_IPA;
  const iosSigningEnabled = signedIpa.enabled;
  const teamIdValidation = iosTeamIdSchema.safeParse(signedIpa.teamId);
  const bundleIdValidation = iosBundleIdSchema.safeParse(signedIpa.bundleId);
  const hasRequiredSigningConfig =
    config.branch.trim().length > 0 &&
    (!androidSigningEnabled || config.android.apk || config.android.aab) &&
    (!iosSigningEnabled ||
      (teamIdValidation.success && bundleIdValidation.success));
  const selectedSigningReady =
    (!androidSigningEnabled || signingQuery.data?.android.ready === true) &&
    (!iosSigningEnabled || signingQuery.data?.ios.ready === true);
  const signingStatusAvailable =
    !signingQuery.isLoading && !signingQuery.isError && signingQuery.data;
  const canSave =
    hasRequiredSigningConfig &&
    (!androidSigningEnabled && !iosSigningEnabled
      ? true
      : Boolean(signingStatusAvailable && selectedSigningReady));

  const configurationIssues = [
    ...(config.branch.trim().length === 0 ? ["Branch is required."] : []),
    ...(androidSigningEnabled && !config.android.apk && !config.android.aab
      ? ["Select at least one Android output for release signing."]
      : []),
    ...(iosSigningEnabled && !teamIdValidation.success
      ? [teamIdValidation.error.issues[0]?.message ?? "Invalid Team ID."]
      : []),
    ...(iosSigningEnabled && !bundleIdValidation.success
      ? [
          bundleIdValidation.error.issues[0]?.message ??
            "Invalid bundle identifier.",
        ]
      : []),
  ];
  const readinessIssues = [
    ...configurationIssues,
    ...collectReadinessIssues({
      androidSigningEnabled,
      iosSigningEnabled,
      isLoading: signingQuery.isLoading,
      errorMessage: signingQuery.error?.message,
      androidIssues: signingQuery.data?.android.issues ?? [],
      iosIssues: signingQuery.data?.ios.issues ?? [],
      androidReady: signingQuery.data?.android.ready ?? false,
      iosReady: signingQuery.data?.ios.ready ?? false,
    }),
  ];

  function updateSignedIpa(patch: Partial<SignedIpaConfig>) {
    setConfig((current) => ({
      ...current,
      ios: {
        ...current.ios,
        signedIpa: {
          ...(current.ios.signedIpa ?? DISABLED_SIGNED_IPA),
          ...patch,
        },
      },
    }));
  }

  async function previewPipeline() {
    if (!hasRequiredSigningConfig) {
      setError("Complete the required signing configuration before previewing.");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsPreviewing(true);

    try {
      const result = await api.github.previewPipeline(owner, repo, {
        projectType: "flutter",
        config,
      });
      setPreview(result.yaml);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Pipeline preview failed.",
      );
    } finally {
      setIsPreviewing(false);
    }
  }

  async function savePipeline() {
    if (!canSave) {
      setError(
        "Resolve the selected platform's signing readiness issues before saving.",
      );
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const result = await api.github.applyPipeline(owner, repo, {
        projectType: "flutter",
        config,
      });

      setSuccess(
        result.workflow.created
          ? "Pipeline created successfully."
          : "Pipeline updated successfully.",
      );
      onApplied?.();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : mode === "edit"
            ? "Pipeline update failed."
            : "Pipeline creation failed.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            Pipeline builder
          </p>
          <h3 className="mt-1 text-xl font-semibold">Flutter CI/CD</h3>
          <p className="mt-2 text-sm text-zinc-500">
            {owner}/{repo}
          </p>
          {mode === "edit" && (
            <p className="mt-2 text-xs text-zinc-600">
              Editing existing Homemade CI/CD pipeline
            </p>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-5">
            <BuilderCard icon={<Code2 size={17} />} title="Quality checks">
              <Checkbox
                label="Flutter analyze"
                checked={config.checks.analyze}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    checks: { ...current.checks, analyze: value },
                  }))
                }
              />
              <Checkbox
                label="Flutter tests"
                checked={config.checks.test}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    checks: { ...current.checks, test: value },
                  }))
                }
              />
            </BuilderCard>

            <BuilderCard icon={<Smartphone size={17} />} title="Android">
              <Checkbox
                label="Enable Android build"
                checked={config.android.enabled}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    android: {
                      ...current.android,
                      enabled: value,
                      signing: value
                        ? current.android.signing ?? DISABLED_ANDROID_SIGNING
                        : DISABLED_ANDROID_SIGNING,
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
                    android: { ...current.android, apk: value },
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
                    android: { ...current.android, aab: value },
                  }))
                }
              />
              <Checkbox
                label="Use release signing"
                hint="Signed jobs run only for trusted push and manual events."
                checked={androidSigningEnabled}
                disabled={!config.android.enabled}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    android: {
                      ...current.android,
                      signing: { enabled: value },
                    },
                  }))
                }
              />

              {androidSigningEnabled && signingQuery.data && (
                <InlineReadiness
                  ready={signingQuery.data.android.ready}
                  readyLabel="Android signing ready"
                  pendingLabel="Android signing needs attention"
                />
              )}
            </BuilderCard>

            <BuilderCard icon={<Smartphone size={17} />} title="iOS">
              <Checkbox
                label="Enable iOS build"
                checked={config.ios.enabled}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    ios: {
                      ...current.ios,
                      enabled: value,
                      signedIpa: value
                        ? current.ios.signedIpa ?? DISABLED_SIGNED_IPA
                        : { ...signedIpa, enabled: false },
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
                      signedIpa: value
                        ? {
                            ...(current.ios.signedIpa ?? DISABLED_SIGNED_IPA),
                            enabled: false,
                          }
                        : current.ios.signedIpa ?? DISABLED_SIGNED_IPA,
                    },
                  }))
                }
              />
              <Checkbox
                label="Signed IPA"
                hint="Uses a temporary keychain and provisioning profile on macOS."
                checked={iosSigningEnabled}
                disabled={!config.ios.enabled}
                onChange={(value) =>
                  setConfig((current) => {
                    const existing =
                      current.ios.signedIpa ?? DISABLED_SIGNED_IPA;

                    return {
                      ...current,
                      ios: {
                        ...current.ios,
                        unsignedBuild: value
                          ? false
                          : current.ios.unsignedBuild,
                        signedIpa: {
                          ...existing,
                          enabled: value,
                          teamId:
                            existing.teamId ||
                            signingQuery.data?.ios.detectedTeamId ||
                            "",
                          bundleId:
                            existing.bundleId ||
                            signingQuery.data?.ios.detectedBundleId ||
                            "",
                        },
                      },
                    };
                  })
                }
              />

              {iosSigningEnabled && (
                <div className="mt-4 border-t border-zinc-800 pt-4">
                  <Field label="Apple Development Team ID">
                    <input
                      value={signedIpa.teamId}
                      onChange={(event) =>
                        updateSignedIpa({ teamId: event.target.value })
                      }
                      placeholder="ABCDE12345"
                      className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
                    />
                  </Field>

                  <Field label="Bundle identifier">
                    <input
                      value={signedIpa.bundleId}
                      onChange={(event) =>
                        updateSignedIpa({ bundleId: event.target.value })
                      }
                      placeholder="com.example.app"
                      className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
                    />
                  </Field>

                  <Field label="Export method">
                    <select
                      value={signedIpa.exportMethod}
                      onChange={(event) =>
                        updateSignedIpa({
                          exportMethod: event.target.value as IosExportMethod,
                        })
                      }
                      className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
                    >
                      {IOS_EXPORT_METHODS.map((method) => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {signingQuery.data && (
                    <InlineReadiness
                      ready={signingQuery.data.ios.ready}
                      readyLabel="iOS signing ready"
                      pendingLabel="iOS signing needs attention"
                    />
                  )}
                </div>
              )}
            </BuilderCard>
          </div>

          <div className="space-y-5">
            <BuilderCard icon={<Play size={17} />} title="Triggers">
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
                hint={
                  androidSigningEnabled || iosSigningEnabled
                    ? "Quality checks still run; secret-bearing signing jobs are skipped."
                    : undefined
                }
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
            </BuilderCard>

            {readinessIssues.length > 0 && (
              <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-300">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle size={16} />
                  Signing is not ready
                </div>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-zinc-400">
                  {readinessIssues.map((issue) => (
                    <li key={issue}>• {issue}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-zinc-500">
                  Preview remains available, but Create/Update is blocked until
                  the selected signing platforms are ready.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={previewPipeline}
                disabled={
                  isPreviewing || isSaving || !hasRequiredSigningConfig
                }
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
                disabled={isSaving || isPreviewing || !canSave}
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

      <SigningCredentialsPanel
        owner={owner}
        repo={repo}
        status={signingQuery.data}
        isLoading={signingQuery.isLoading}
        errorMessage={signingQuery.error?.message}
      />
    </>
  );
}

function collectReadinessIssues({
  androidSigningEnabled,
  iosSigningEnabled,
  isLoading,
  errorMessage,
  androidIssues,
  iosIssues,
  androidReady,
  iosReady,
}: {
  androidSigningEnabled: boolean;
  iosSigningEnabled: boolean;
  isLoading: boolean;
  errorMessage?: string;
  androidIssues: string[];
  iosIssues: string[];
  androidReady: boolean;
  iosReady: boolean;
}): string[] {
  if (!androidSigningEnabled && !iosSigningEnabled) {
    return [];
  }

  if (isLoading) {
    return ["Checking repository signing readiness and credential status."];
  }

  if (errorMessage) {
    return [
      `Signing status could not be loaded: ${errorMessage}`,
      "Ensure the fine-grained token has repository Secrets read and write permission.",
    ];
  }

  const issues = [
    ...(androidSigningEnabled && !androidReady ? androidIssues : []),
    ...(iosSigningEnabled && !iosReady ? iosIssues : []),
  ];

  if (androidSigningEnabled && !androidReady && androidIssues.length === 0) {
    issues.push("Android signing is not ready.");
  }

  if (iosSigningEnabled && !iosReady && iosIssues.length === 0) {
    issues.push("iOS signing is not ready.");
  }

  return [...new Set(issues)];
}

function BuilderCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <span className="font-medium">{title}</span>
      </div>
      {children}
    </div>
  );
}

function InlineReadiness({
  ready,
  readyLabel,
  pendingLabel,
}: {
  ready: boolean;
  readyLabel: string;
  pendingLabel: string;
}) {
  return (
    <div
      className={`mt-3 flex items-center gap-2 rounded-lg border p-3 text-xs ${
        ready
          ? "border-emerald-900/70 bg-emerald-950/20 text-emerald-300"
          : "border-amber-900/60 bg-amber-950/20 text-amber-300"
      }`}
    >
      {ready ? <ShieldCheck size={15} /> : <AlertTriangle size={15} />}
      {ready ? readyLabel : pendingLabel}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
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
