import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";

interface SigningReadiness {
  platformPresent: boolean;
  projectReady: boolean;
  credentialsReady: boolean;
  ready: boolean;
  issues: string[];
}

export function SigningStatusSummary({
  status,
}: {
  status: SigningReadiness | undefined;
}) {
  if (!status) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-500">
        Signing status is unavailable.
      </div>
    );
  }

  const label = status.ready
    ? "Ready"
    : !status.platformPresent
      ? "Platform not detected"
      : !status.projectReady
        ? "Project configuration required"
        : !status.credentialsReady
          ? "Missing credentials"
          : "Not ready";

  return (
    <div
      className={`rounded-lg border p-3 text-xs ${
        status.ready
          ? "border-emerald-900/70 bg-emerald-950/20 text-emerald-300"
          : "border-amber-900/60 bg-amber-950/20 text-amber-300"
      }`}
    >
      <div className="flex items-center gap-2 font-medium">
        {status.ready ? (
          <CheckCircle2 size={15} />
        ) : (
          <AlertTriangle size={15} />
        )}
        {label}
      </div>

      {status.issues.length > 0 && (
        <ul className="mt-2 space-y-1 text-zinc-400">
          {status.issues.map((issue) => (
            <li key={issue}>• {issue}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SecretStatusList({
  secrets,
}: {
  secrets: Array<{ label: string; configured: boolean }>;
}) {
  return (
    <ul className="grid gap-2 text-xs sm:grid-cols-2">
      {secrets.map((secret) => (
        <li
          key={secret.label}
          className="flex items-center gap-2 text-zinc-400"
        >
          {secret.configured ? (
            <CheckCircle2 className="text-emerald-400" size={14} />
          ) : (
            <Circle className="text-zinc-600" size={14} />
          )}
          <span>{secret.label}</span>
          <span className="ml-auto text-zinc-600">
            {secret.configured ? "Configured" : "Missing"}
          </span>
        </li>
      ))}
    </ul>
  );
}
