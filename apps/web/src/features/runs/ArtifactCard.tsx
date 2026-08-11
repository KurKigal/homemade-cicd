import type {
  WorkflowArtifact,
} from "@homemade-cicd/core";

import {
  Archive,
  Download,
} from "lucide-react";

interface ArtifactCardProps {
  owner: string;
  repo: string;

  artifact: WorkflowArtifact;
}

export function ArtifactCard({
  owner,
  repo,
  artifact,
}: ArtifactCardProps) {
  const downloadUrl =
    `/api/github/repos/` +
    `${encodeURIComponent(owner)}/` +
    `${encodeURIComponent(repo)}/` +
    `artifacts/${artifact.id}/download`;

  return (
    <div className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
          <Archive
            size={19}
            className="text-zinc-300"
          />
        </div>

        <div className="min-w-0">
          <h4 className="truncate font-medium">
            {artifact.name}
          </h4>

          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
            <span>
              {formatFileSize(
                artifact.sizeInBytes,
              )}
            </span>

            {artifact.expiresAt && (
              <span>
                Expires{" "}
                {formatDate(
                  artifact.expiresAt,
                )}
              </span>
            )}

            {artifact.expired && (
              <span className="text-red-400">
                Expired
              </span>
            )}
          </div>
        </div>
      </div>

      <a
        href={
          artifact.expired
            ? undefined
            : downloadUrl
        }
        aria-disabled={
          artifact.expired
        }
        className={[
          "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border px-3 text-sm transition",

          artifact.expired
            ? "pointer-events-none border-zinc-800 text-zinc-700"
            : "border-zinc-700 text-zinc-200 hover:bg-zinc-900",
        ].join(" ")}
      >
        <Download size={15} />
        Download
      </a>
    </div>
  );
}

function formatFileSize(
  bytes: number,
): string {
  if (bytes === 0) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
  ];

  const index = Math.min(
    Math.floor(
      Math.log(bytes) /
        Math.log(1024),
    ),
    units.length - 1,
  );

  const value =
    bytes /
    Math.pow(
      1024,
      index,
    );

  return `${value.toFixed(
    index === 0 ? 0 : 1,
  )} ${units[index]}`;
}

function formatDate(
  date: string,
): string {
  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      dateStyle: "medium",
    },
  ).format(new Date(date));
}