import { useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import type { RepositorySigningStatus } from "@homemade-cicd/core";

import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import {
  credentialFileToBase64,
  validateSecretValue,
} from "./credential-files";
import {
  SecretStatusList,
  SigningStatusSummary,
} from "./SigningStatusSummary";

const ANDROID_KEYSTORE_EXTENSIONS = [".jks", ".keystore"] as const;

interface AndroidSigningCredentialsProps {
  owner: string;
  repo: string;
  status: RepositorySigningStatus["android"] | undefined;
}

export function AndroidSigningCredentials({
  owner,
  repo,
  status,
}: AndroidSigningCredentialsProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [keystore, setKeystore] = useState<File | null>(null);
  const [keyAlias, setKeyAlias] = useState("");
  const [storePassword, setStorePassword] = useState("");
  const [keyPassword, setKeyPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasAnyCredential = status
    ? Object.values(status.secrets).some(Boolean)
    : false;

  function clearSensitiveFields() {
    setKeystore(null);
    setKeyAlias("");
    setStorePassword("");
    setKeyPassword("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function refreshStatus() {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.signing(owner, repo),
    });
  }

  async function saveCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!keystore) {
      setError("Select a .jks or .keystore file.");
      return;
    }

    setIsSaving(true);

    try {
      const normalizedKeyAlias = keyAlias.trim();

      validateSecretValue(normalizedKeyAlias, "Key alias");
      validateSecretValue(storePassword, "Store password");
      validateSecretValue(keyPassword, "Key password");

      const keystoreBase64 = await credentialFileToBase64(
        keystore,
        ANDROID_KEYSTORE_EXTENSIONS,
        "Keystore",
      );

      await api.github.saveAndroidSigningCredentials(owner, repo, {
        keystoreBase64,
        storePassword,
        keyPassword,
        keyAlias: normalizedKeyAlias,
      });

      clearSensitiveFields();
      setSuccess("Android signing credentials saved.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Android credentials could not be saved.",
      );
    } finally {
      refreshStatus();
      setIsSaving(false);
    }
  }

  async function removeCredentials() {
    if (
      !window.confirm(
        "Remove all Android signing credentials from this repository?",
      )
    ) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsRemoving(true);

    try {
      await api.github.deleteAndroidSigningCredentials(owner, repo);
      clearSensitiveFields();
      setSuccess("Android signing credentials removed.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Android credentials could not be removed.",
      );
    } finally {
      refreshStatus();
      setIsRemoving(false);
    }
  }

  const busy = isSaving || isRemoving;

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div>
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          Android signing
        </p>
        <h4 className="mt-1 font-medium">Keystore credentials</h4>
      </div>

      <div className="mt-4">
        <SigningStatusSummary status={status} />
      </div>

      {status && (
        <div className="mt-4">
          <SecretStatusList
            secrets={[
              { label: "Keystore", configured: status.secrets.keystore },
              {
                label: "Store password",
                configured: status.secrets.storePassword,
              },
              {
                label: "Key password",
                configured: status.secrets.keyPassword,
              },
              { label: "Key alias", configured: status.secrets.keyAlias },
            ]}
          />
        </div>
      )}

      <form className="mt-5 space-y-4" onSubmit={saveCredentials}>
        <CredentialField label="Keystore file (.jks or .keystore)">
          <input
            ref={fileInputRef}
            type="file"
            accept=".jks,.keystore"
            disabled={busy}
            onChange={(event) => {
              setKeystore(event.target.files?.[0] ?? null);
              setError(null);
              setSuccess(null);
            }}
            className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-xs file:text-zinc-200"
          />
        </CredentialField>

        <CredentialField label="Key alias">
          <input
            value={keyAlias}
            disabled={busy}
            autoComplete="off"
            onChange={(event) => setKeyAlias(event.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
          />
        </CredentialField>

        <div className="grid gap-4 sm:grid-cols-2">
          <CredentialField label="Store password">
            <input
              type="password"
              value={storePassword}
              disabled={busy}
              autoComplete="new-password"
              onChange={(event) => setStorePassword(event.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
            />
          </CredentialField>

          <CredentialField label="Key password">
            <input
              type="password"
              value={keyPassword}
              disabled={busy}
              autoComplete="new-password"
              onChange={(event) => setKeyPassword(event.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
            />
          </CredentialField>
        </div>

        <p className="text-xs leading-5 text-zinc-600">
          Saving replaces the complete Android credential set. Existing secret
          values are never loaded into this form.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-zinc-100 px-4 text-sm font-medium text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            Save credentials
          </button>

          <button
            type="button"
            disabled={busy || !hasAnyCredential}
            onClick={removeCredentials}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-900/70 px-4 text-sm text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRemoving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Trash2 size={15} />
            )}
            Remove credentials
          </button>
        </div>
      </form>

      {success && (
        <p className="mt-4 rounded-lg border border-emerald-900/70 bg-emerald-950/20 p-3 text-xs text-emerald-300">
          {success}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-red-900/70 bg-red-950/20 p-3 text-xs text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}

function CredentialField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
