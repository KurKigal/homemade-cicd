import type {
  PythonDependencySource,
  RepositoryInspection,
} from "@homemade-cicd/core";

import {
  PipelineBuilder,
} from "../pipelines/PipelineBuilder";

import {
  NodePipelineBuilder,
} from "../pipelines/NodePipelineBuilder";

import {
  PythonPipelineBuilder,
} from "../pipelines/PythonPipelineBuilder";

import type {
  SelectedRepository,
} from "../repositories/types";

import {
  Link,
} from "react-router";

interface ProjectAnalysisPanelProps {
  repository: SelectedRepository;

  inspection:
    | RepositoryInspection
    | undefined;

  isLoading: boolean;

  errorMessage?: string;

  onClose: () => void;
}

export function ProjectAnalysisPanel({
  repository,
  inspection,
  isLoading,
  errorMessage,
  onClose,
}: ProjectAnalysisPanelProps) {
  return (
    <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            Project analysis
          </p>

          <h3 className="mt-1 text-xl font-semibold">
            {repository.owner}/
            {repository.name}
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to={`/runs/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900"
          >
            View Runs
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-200"
          >
            Close
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="text-sm text-zinc-500">
          Inspecting repository structure...
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-400">
          {errorMessage}
        </div>
      )}

      {inspection && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <AnalysisCard
              label="Framework"
              value={
                inspection.analysis.framework ??
                "Unknown"
              }
            />

            <AnalysisCard
              label="Language"
              value={
                inspection.analysis.language ??
                "Unknown"
              }
            />

            <AnalysisCard
              label="Package manager"
              value={
                inspection.analysis.projectType === "python"
                  ? inspection.analysis.python?.packageManager ??
                    "Not detected"
                  : inspection.analysis.packageManager ??
                "Not detected"
              }
            />

            {inspection.analysis.projectType ===
              "flutter" && (
              <>
                <AnalysisCard
                  label="Android"
                  value={
                    inspection.analysis.platforms
                      .android
                      ? "Ready"
                      : "Not detected"
                  }
                />

                <AnalysisCard
                  label="iOS"
                  value={
                    inspection.analysis.platforms.ios
                      ? "Ready"
                      : "Not detected"
                  }
                />
              </>
            )}

            {inspection.analysis.projectType ===
              "node" && (
              <>
                <AnalysisCard
                  label="Lockfile"
                  value={
                    inspection.analysis.lockfilePresent
                      ? "Detected"
                      : "Not detected"
                  }
                />

                <AnalysisCard
                  label="Package scripts"
                  value={`${inspection.analysis.availableScripts.length} detected`}
                />
              </>
            )}

            {inspection.analysis.projectType ===
              "python" &&
              inspection.analysis.python && (
              <>
                <AnalysisCard
                  label="Lockfile"
                  value={
                    inspection.analysis.python.lockfilePresent
                      ? "Detected"
                      : "Not detected"
                  }
                />

                <AnalysisCard
                  label="Dependency source"
                  value={
                    pythonDependencySourceLabel(
                      inspection.analysis.python.dependencySource,
                    )
                  }
                />

                <AnalysisCard
                  label="Python tasks"
                  value={`${Object.values(
                    inspection.analysis.python.availableTasks,
                  ).filter(Boolean).length} detected`}
                />
              </>
            )}

            <AnalysisCard
              label="Existing CI/CD"
              value={
                inspection.analysis.ciConfigured
                  ? "Detected"
                  : "Not configured"
              }
            />

            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 md:col-span-2 lg:col-span-3">
              <p className="text-xs text-zinc-500">
                Detection signals
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                {inspection.analysis.signals
                  .length > 0 ? (
                  inspection.analysis.signals.map(
                    (signal) => (
                      <span
                        key={signal}
                        className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                      >
                        {signal}
                      </span>
                    ),
                  )
                ) : (
                  <span className="text-sm text-zinc-500">
                    No known project markers
                    detected.
                  </span>
                )}
              </div>
            </div>

            {inspection.analysis.projectType ===
              "node" && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 md:col-span-2 lg:col-span-4">
                <p className="text-xs text-zinc-500">
                  Available package scripts
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {inspection.analysis.availableScripts
                    .length > 0 ? (
                    inspection.analysis.availableScripts.map(
                      (script) => (
                        <span
                          key={script}
                          className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                        >
                          {script}
                        </span>
                      ),
                    )
                  ) : (
                    <span className="text-sm text-zinc-500">
                      No package scripts detected.
                    </span>
                  )}
                </div>
              </div>
            )}

            {inspection.analysis.projectType ===
              "python" &&
              inspection.analysis.python && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 md:col-span-2 lg:col-span-4">
                <p className="text-xs text-zinc-500">
                  Available Python tasks
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(
                    inspection.analysis.python.availableTasks,
                  ).some(([, available]) => available) ? (
                    Object.entries(
                      inspection.analysis.python.availableTasks,
                    )
                      .filter(([, available]) => available)
                      .map(([task]) => (
                        <span
                          key={task}
                          className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                        >
                          {task}
                        </span>
                      ))
                  ) : (
                    <span className="text-sm text-zinc-500">
                      No supported Python tasks detected.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {inspection.analysis.projectType ===
            "flutter" && (
            <PipelineBuilder
              owner={repository.owner}
              repo={repository.name}
              defaultBranch={
                repository.defaultBranch
              }
            />
          )}

          {inspection.analysis.projectType ===
            "node" && (
            <NodePipelineBuilder
              owner={repository.owner}
              repo={repository.name}
              defaultBranch={
                repository.defaultBranch
              }
              packageManager={
                inspection.analysis.packageManager
              }
              availableScripts={
                inspection.analysis.availableScripts
              }
              lockfilePresent={
                inspection.analysis.lockfilePresent
              }
            />
          )}

          {inspection.analysis.projectType ===
            "python" &&
            inspection.analysis.python && (
            <PythonPipelineBuilder
              owner={repository.owner}
              repo={repository.name}
              defaultBranch={repository.defaultBranch}
              packageManager={
                inspection.analysis.python.packageManager
              }
              dependencySource={
                inspection.analysis.python.dependencySource
              }
              availableTasks={
                inspection.analysis.python.availableTasks
              }
              lockfilePresent={
                inspection.analysis.python.lockfilePresent
              }
            />
          )}

          {inspection.analysis.projectType ===
            "python" &&
            !inspection.analysis.python && (
            <div className="mt-6 rounded-lg border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-300">
              Python metadata could not be determined for this repository.
            </div>
          )}

          {inspection.analysis.projectType !==
            "flutter" &&
            inspection.analysis.projectType !==
              "node" &&
            inspection.analysis.projectType !==
              "python" && (
            <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-sm text-zinc-500">
                Pipeline Builder is currently
                available for Flutter, Node.js and Python
                projects. Support for this project
                type will be added later.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function pythonDependencySourceLabel(
  source: PythonDependencySource,
): string {
  switch (source) {
    case "requirements":
      return "requirements.txt";

    case "requirements-dev":
      return "requirements-dev.txt";

    case "requirements_dev":
      return "requirements_dev.txt";

    case "project":
      return "pyproject.toml / setup.py";

    case "pipfile":
      return "Pipfile";
  }
}

function AnalysisCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs text-zinc-500">
        {label}
      </p>

      <p className="mt-2 font-medium">
        {value}
      </p>
    </div>
  );
}
