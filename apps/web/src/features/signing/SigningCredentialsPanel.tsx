import { KeyRound, Loader2, ShieldCheck } from "lucide-react";

import type { RepositorySigningStatus } from "@homemade-cicd/core";

import { AndroidSigningCredentials } from "./AndroidSigningCredentials";
import { IosSigningCredentials } from "./IosSigningCredentials";

interface SigningCredentialsPanelProps {
  owner: string;
  repo: string;
  status: RepositorySigningStatus | undefined;
  isLoading: boolean;
  errorMessage?: string;
}

export function SigningCredentialsPanel({
  owner,
  repo,
  status,
  isLoading,
  errorMessage,
}: SigningCredentialsPanelProps) {
  return (
    <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row">
        <div>
          <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
            <KeyRound size={14} />
            Signing credentials
          </p>
          <h3 className="mt-1 text-xl font-semibold">Mobile signing access</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
            Credential values are sent to the local API and stored only as
            GitHub Actions repository secrets. Homemade never reads existing
            values back.
          </p>
        </div>

        <div className="flex h-fit items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
          <ShieldCheck size={15} className="text-emerald-400" />
          Repository Secrets: read and write
        </div>
      </div>

      {isLoading && (
        <div className="mt-5 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-500">
          <Loader2 size={16} className="animate-spin" />
          Checking signing readiness and secret status...
        </div>
      )}

      {errorMessage && (
        <div className="mt-5 rounded-lg border border-amber-900/60 bg-amber-950/20 p-4 text-sm leading-6 text-amber-300">
          Signing status could not be loaded: {errorMessage} Ensure the
          fine-grained token has repository Secrets read and write permission.
          Unsigned pipelines remain available.
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <AndroidSigningCredentials
          owner={owner}
          repo={repo}
          status={status?.android}
        />
        <IosSigningCredentials
          owner={owner}
          repo={repo}
          status={status?.ios}
        />
      </div>

      <p className="mt-4 text-xs leading-5 text-zinc-600">
        Files are base64-encoded in browser memory and rejected before upload
        if the encoded value exceeds GitHub Actions&apos; 48 KB secret limit.
        Password and file fields are cleared after a successful save.
      </p>
    </section>
  );
}
