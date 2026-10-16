import type {
  FormEvent,
} from "react";

import {
  useState,
} from "react";

import type {
  CreateReleaseRequest,
  CreateReleaseResult,
  ReleaseNotesMode,
  ReleaseSource,
} from "@homemade-cicd/core";

import {
  RELEASE_ARTIFACT_MAX_BYTES,
} from "@homemade-cicd/core";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  ExternalLink,
} from "lucide-react";

import {
  api,
} from "../../lib/api";

import {
  queryKeys,
} from "../../lib/query-keys";

import {
  ReleaseArtifactSelector,
} from "./ReleaseArtifactSelector";

import {
  ReleaseSourcePicker,
} from "./ReleaseSourcePicker";

interface ReleaseBuilderProps {
  owner: string;
  repo: string;
  defaultBranch: string;
}

export function ReleaseBuilder({
  owner,
  repo,
  defaultBranch,
}: ReleaseBuilderProps) {
  const queryClient = useQueryClient();

  const [tagName, setTagName] = useState("");
  const [releaseName, setReleaseName] = useState("");
  const [notesMode, setNotesMode] = useState<ReleaseNotesMode>("manual");
  const [notesBody, setNotesBody] = useState("");
  const [draft, setDraft] = useState(true);
  const [prerelease, setPrerelease] = useState(false);
  const [sourceType, setSourceType] =
    useState<ReleaseSource["type"]>("defaultBranch");
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [result, setResult] = useState<CreateReleaseResult | null>(null);

  const runsQuery = useQuery({
    queryKey: queryKeys.runs(owner, repo),
    queryFn: () => api.github.workflowRuns(owner, repo),
    enabled: sourceType === "workflowRun",
  });

  const successfulRuns =
    runsQuery.data?.runs.filter(
      (run) =>
        run.status === "completed" &&
        run.conclusion === "success",
    ) ?? [];

  const selectedRun = successfulRuns.find(
    (run) => run.id === selectedRunId,
  );

  const artifactsQuery = useQuery({
    queryKey: queryKeys.runArtifacts(owner, repo, selectedRunId ?? 0),
    queryFn: () => {
      if (selectedRunId === null) {
        throw new Error("Workflow run not selected.");
      }

      return api.github.workflowRunArtifacts(owner, repo, selectedRunId);
    },
    enabled: sourceType === "workflowRun" && selectedRunId !== null,
  });

  const eligibleSelectedArtifactIds = artifactsQuery.isError
    ? []
    : artifactsQuery.data?.artifacts
        .filter(
          (artifact) =>
            !artifact.expired &&
            artifact.sizeInBytes <= RELEASE_ARTIFACT_MAX_BYTES &&
            selectedArtifactIds.has(artifact.id),
        )
        .map((artifact) => artifact.id) ?? [];

  const selectedArtifactsReady =
    selectedArtifactIds.size === 0 ||
    (!artifactsQuery.isLoading &&
      !artifactsQuery.isError &&
      eligibleSelectedArtifactIds.length === selectedArtifactIds.size);

  const artifactSelectionIssue =
    selectedArtifactIds.size === 0 || selectedArtifactsReady
      ? undefined
      : artifactsQuery.isLoading
        ? "Wait for the selected artifacts to finish loading."
        : artifactsQuery.isError
          ? "Artifact status could not be refreshed. Clear the previous selection or retry before creating the release."
          : "One or more selected artifacts are no longer available, have expired, or exceed the release size limit.";

  const createMutation = useMutation({
    mutationFn: (request: CreateReleaseRequest) =>
      api.github.createRelease(owner, repo, request),
    onMutate: () => {
      setResult(null);
    },
    onSuccess: async (creationResult) => {
      setResult(creationResult);

      await queryClient.invalidateQueries({
        queryKey: queryKeys.releases(owner, repo),
      });
    },
  });

  const normalizedTag = tagName.trim();
  const canSubmit =
    normalizedTag.length > 0 &&
    (sourceType === "defaultBranch" || selectedRun !== undefined) &&
    selectedArtifactsReady &&
    !createMutation.isPending;

  function changeSource(nextSource: ReleaseSource["type"]) {
    setSourceType(nextSource);
    setSelectedRunId(null);
    setSelectedArtifactIds(new Set());
  }

  function changeRun(runId: number | null) {
    setSelectedRunId(runId);
    setSelectedArtifactIds(new Set());
  }

  function toggleArtifact(artifactId: number, selected: boolean) {
    setSelectedArtifactIds((current) => {
      const next = new Set(current);

      if (selected) {
        next.add(artifactId);
      } else {
        next.delete(artifactId);
      }

      return next;
    });
  }

  function clearUnavailableArtifacts() {
    const eligibleIds = new Set(eligibleSelectedArtifactIds);

    setSelectedArtifactIds((current) => {
      if (artifactsQuery.isError) {
        return new Set();
      }

      return new Set(
        [...current].filter((artifactId) => eligibleIds.has(artifactId)),
      );
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    const normalizedName = releaseName.trim();
    const notes: CreateReleaseRequest["notes"] =
      notesMode === "generated"
        ? { mode: "generated" }
        : {
            mode: "manual",
            body: notesBody,
          };

    let source: CreateReleaseRequest["source"];

    if (sourceType === "defaultBranch") {
      source = { type: "defaultBranch" };
    } else if (selectedRun) {
      source = {
        type: "workflowRun",
        runId: selectedRun.id,
        artifactIds: [...selectedArtifactIds],
      };
    } else {
      return;
    }

    const request: CreateReleaseRequest = {
      tagName: normalizedTag,
      ...(normalizedName ? { name: normalizedName } : {}),
      notes,
      draft,
      prerelease,
      source,
    };

    createMutation.mutate(request);
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/30">
      <div className="border-b border-zinc-800 p-5">
        <h3 className="font-semibold">
          Create release
        </h3>

        <p className="mt-1 text-sm text-zinc-500">
          Create a GitHub release from the default branch or an exact
          successful build commit.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="space-y-6 p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-200">
              Tag / version
            </span>

            <input
              type="text"
              value={tagName}
              onChange={(event) => setTagName(event.target.value)}
              placeholder="v1.0.0"
              required
              className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-600"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-200">
              Release name
            </span>

            <input
              type="text"
              value={releaseName}
              onChange={(event) => setReleaseName(event.target.value)}
              placeholder="Optional; GitHub can use the tag"
              className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-600"
            />
          </label>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-zinc-200">
            Release notes
          </legend>

          <div className="mt-3 flex flex-wrap gap-5 text-sm">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="release-notes"
                value="manual"
                checked={notesMode === "manual"}
                onChange={() => setNotesMode("manual")}
                className="accent-zinc-100"
              />
              Write manually
            </label>

            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="release-notes"
                value="generated"
                checked={notesMode === "generated"}
                onChange={() => setNotesMode("generated")}
                className="accent-zinc-100"
              />
              Generate with GitHub
            </label>
          </div>

          {notesMode === "manual" ? (
            <textarea
              value={notesBody}
              onChange={(event) => setNotesBody(event.target.value)}
              rows={7}
              placeholder="Write release notes in Markdown..."
              className="mt-3 w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm leading-6 outline-none focus:border-zinc-600"
            />
          ) : (
            <p className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-500">
              GitHub will generate the release notes. No manual body will be
              sent.
            </p>
          )}
        </fieldset>

        <div className="flex flex-wrap gap-x-6 gap-y-3 border-y border-zinc-800 py-4 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={draft}
              onChange={(event) => setDraft(event.target.checked)}
              className="accent-zinc-100"
            />
            Create as draft
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={prerelease}
              onChange={(event) => setPrerelease(event.target.checked)}
              className="accent-zinc-100"
            />
            Mark as prerelease
          </label>
        </div>

        <ReleaseSourcePicker
          sourceType={sourceType}
          defaultBranch={defaultBranch}
          runs={successfulRuns}
          selectedRunId={selectedRunId}
          selectedRun={selectedRun}
          isLoading={runsQuery.isLoading}
          errorMessage={runsQuery.isError ? runsQuery.error.message : undefined}
          onSourceTypeChange={changeSource}
          onRunChange={changeRun}
        />

        {sourceType === "workflowRun" && selectedRun && (
          <>
            <ReleaseArtifactSelector
              artifacts={artifactsQuery.data?.artifacts ?? []}
              selectedArtifactIds={selectedArtifactIds}
              isLoading={artifactsQuery.isLoading}
              errorMessage={
                artifactsQuery.isError
                  ? artifactsQuery.error.message
                  : undefined
              }
              onToggle={toggleArtifact}
            />

            {artifactSelectionIssue && (
              <div className="mt-3 rounded-lg border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-300">
                <p>{artifactSelectionIssue}</p>

                <button
                  type="button"
                  onClick={clearUnavailableArtifacts}
                  className="mt-3 rounded-lg border border-amber-800 px-3 py-2 text-xs font-medium transition hover:bg-amber-950"
                >
                  Clear unavailable selections
                </button>
              </div>
            )}
          </>
        )}

        {createMutation.isError && (
          <div className="rounded-lg border border-red-900/60 bg-red-950/20 p-4 text-sm text-red-400">
            {createMutation.error.message}
          </div>
        )}

        {result && (
          <ReleaseResult result={result} />
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-zinc-100 px-5 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {createMutation.isPending
            ? "Creating release..."
            : "Create Release"}
        </button>
      </form>
    </section>
  );
}

function ReleaseResult({
  result,
}: {
  result: CreateReleaseResult;
}) {
  const partial = result.outcome === "partial";
  const message =
    result.outcome === "published"
      ? `Release ${result.release.tagName} published successfully.`
      : result.outcome === "draft"
        ? `Draft release ${result.release.tagName} created.`
        : result.publicationError
          ? `Release ${result.release.tagName} remains a draft because publishing failed.`
          : `Release draft created, but ${result.failedArtifacts.length} artifact${
              result.failedArtifacts.length === 1 ? "" : "s"
            } failed to upload.`;

  return (
    <div
      className={[
        "rounded-lg border p-4 text-sm",
        partial
          ? "border-amber-900/60 bg-amber-950/20 text-amber-300"
          : "border-emerald-900/60 bg-emerald-950/20 text-emerald-300",
      ].join(" ")}
    >
      <p className="font-medium">
        {message}
      </p>

      {partial && result.publicationError && (
        <p className="mt-2 text-xs text-amber-200">
          {result.publicationError}
        </p>
      )}

      {partial && result.failedArtifacts.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-200">
          {result.failedArtifacts.map((artifact) => (
            <li key={artifact.artifactId}>
              {artifact.name}: {artifact.error}
            </li>
          ))}
        </ul>
      )}

      <a
        href={result.release.htmlUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-2 underline underline-offset-4"
      >
        {partial ? "Open draft on GitHub" : "Open on GitHub"}
        <ExternalLink size={14} />
      </a>
    </div>
  );
}
