export interface WorkflowRunActor {
  login: string;
  avatarUrl: string;
}

export interface WorkflowRun {
  id: number;

  workflowName: string;
  displayTitle: string;

  runNumber: number;
  attempt: number;

  event: string;

  status: string;
  conclusion: string | null;

  headBranch: string | null;
  headSha: string;

  htmlUrl: string;

  createdAt: string;
  updatedAt: string;
  startedAt: string | null;

  actor: WorkflowRunActor | null;
}

export interface WorkflowStep {
  number: number;
  name: string;

  status: string;
  conclusion: string | null;

  startedAt: string | null;
  completedAt: string | null;
}

export interface WorkflowJob {
  id: number;

  name: string;

  status: string;
  conclusion: string | null;

  startedAt: string | null;
  completedAt: string | null;

  htmlUrl: string | null;

  runnerName: string | null;

  labels: string[];

  steps: WorkflowStep[];
}

export interface WorkflowRunsResponse {
  totalCount: number;
  runs: WorkflowRun[];
}

export interface WorkflowRunResponse {
  run: WorkflowRun;
}

export interface WorkflowJobsResponse {
  totalCount: number;
  jobs: WorkflowJob[];
}

export interface WorkflowCommandResult {
  success: boolean;
  message: string;
}