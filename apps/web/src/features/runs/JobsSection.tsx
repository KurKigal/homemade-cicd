import type { WorkflowJob } from "@homemade-cicd/core";

import { RunStatusBadge } from "./RunStatusBadge";

interface JobsSectionProps {
  jobs: WorkflowJob[];
  isLoading: boolean;
  errorMessage?: string;
}

export function JobsSection({
  jobs,
  isLoading,
  errorMessage,
}: JobsSectionProps) {
  return (
    <section>
      <h3 className="mb-4 text-lg font-semibold">Jobs</h3>

      {isLoading ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-sm text-zinc-500">
          Loading jobs...
        </div>
      ) : errorMessage ? (
        <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-5 text-sm text-red-400">
          {errorMessage}
        </div>
      ) : jobs.length > 0 ? (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-medium">{job.name}</h4>

                  {job.runnerName && (
                    <p className="mt-1 text-xs text-zinc-600">
                      Runner: {job.runnerName}
                    </p>
                  )}
                </div>

                <RunStatusBadge
                  status={job.status}
                  conclusion={job.conclusion}
                />
              </div>

              {job.steps.length > 0 && (
                <div className="mt-5 space-y-2 border-t border-zinc-800 pt-4">
                  {job.steps.map((step) => (
                    <div
                      key={step.number}
                      className="flex items-center justify-between gap-4 rounded-lg px-2 py-2 text-sm"
                    >
                      <span className="text-zinc-400">
                        {step.number}. {step.name}
                      </span>

                      <RunStatusBadge
                        status={step.status}
                        conclusion={step.conclusion}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
          No jobs found for this workflow run.
        </div>
      )}
    </section>
  );
}
