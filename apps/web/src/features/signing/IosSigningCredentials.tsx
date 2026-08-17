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

const IOS_CERTIFICATE_EXTENSIONS = [".p12"] as const;
const IOS_PROFILE_EXTENSIONS = [".mobileprovision"] as const;

interface IosSigningCredentialsProps {
  owner: string;
  repo: string;
  status: RepositorySigningStatus["ios"] | undefined;
}

export function IosSigningCredentials({
  owner,
  repo,
  status,
}: IosSigningCredentialsProps) {
  const queryClient = useQueryClient();
  const certificateInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const [certificate, setCertificate] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState("");
  const [provisioningProfile, setProvisioningProfile] =
    useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasAnyCredential = status
    ? Object.values(status.secrets).some(Boolean)
    : false;

  function clearSensitiveFields() {
    setCertificate(null);
    setCertificatePassword("");
    setProvisioningProfile(null);

    if (certificateInputRef.current) {
      certificateInputRef.current.value = "";
    }

    if (profileInputRef.current) {
      profileInputRef.current.value = "";
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

    if (!certificate || !provisioningProfile) {
      setError("Select both a .p12 certificate and a .mobileprovision file.");
      return;
    }

    setIsSaving(true);

    try {
      validateSecretValue(certificatePassword, "Certificate password");

      const [certificateP12Base64, provisioningProfileBase64] =
        await Promise.all([
          credentialFileToBase64(
            certificate,
            IOS_CERTIFICATE_EXTENSIONS,
            "Distribution certificate",
          ),
          credentialFileToBase64(
            provisioningProfile,
            IOS_PROFILE_EXTENSIONS,
            "Provisioning profile",
          ),
        ]);

      await api.github.saveIosSigningCredentials(owner, repo, {
        certificateP12Base64,
        certificatePassword,
        provisioningProfileBase64,
      });

      clearSensitiveFields();
      setSuccess("iOS signing credentials saved.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "iOS credentials could not be saved.",
      );
    } finally {
      refreshStatus();
      setIsSaving(false);
    }
  }

  async function removeCredentials() {
    if (
      !window.confirm(
        "Remove all iOS signing credentials from this repository?",
      )
    ) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsRemoving(true);

    try {
      await api.github.deleteIosSigningCredentials(owner, repo);
      clearSensitiveFields();
      setSuccess("iOS signing credentials removed.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "iOS credentials could not be removed.",
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
          iOS signing
        </p>
        <h4 className="mt-1 font-medium">Distribution credentials</h4>
      </div>

      <div className="mt-4">
        <SigningStatusSummary status={status} />
      </div>

      {status && (
        <div className="mt-4">
          <SecretStatusList
            secrets={[
              {
                label: "Certificate",
                configured: status.secrets.certificate,
              },
              {
                label: "Certificate password",
                configured: status.secrets.certificatePassword,
              },
              {
                label: "Provisioning profile",
                configured: status.secrets.provisioningProfile,
              },
            ]}
          />
        </div>
      )}

      <form className="mt-5 space-y-4" onSubmit={saveCredentials}>
        <CredentialField label="Distribution certificate (.p12)">
          <input
            ref={certificateInputRef}
            type="file"
            accept=".p12"
            disabled={busy}
            onChange={(event) => {
              setCertificate(event.target.files?.[0] ?? null);
              setError(null);
              setSuccess(null);
            }}
            className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-xs file:text-zinc-200"
          />
        </CredentialField>

        <CredentialField label="Certificate password">
          <input
            type="password"
            value={certificatePassword}
            disabled={busy}
            autoComplete="new-password"
            onChange={(event) => setCertificatePassword(event.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
          />
        </CredentialField>

        <CredentialField label="Provisioning profile (.mobileprovision)">
          <input
            ref={profileInputRef}
            type="file"
            accept=".mobileprovision"
            disabled={busy}
            onChange={(event) => {
              setProvisioningProfile(event.target.files?.[0] ?? null);
              setError(null);
              setSuccess(null);
            }}
            className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-xs file:text-zinc-200"
          />
        </CredentialField>

        <p className="text-xs leading-5 text-zinc-600">
          Saving replaces the complete iOS credential set. Existing secret
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
