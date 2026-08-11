export interface WorkflowArtifact {
  id: number;

  name: string;

  sizeInBytes: number;

  expired: boolean;

  createdAt: string | null;
  updatedAt: string | null;
  expiresAt: string | null;

  digest: string | null;

  workflowRun: {
    id: number;
    headBranch: string | null;
    headSha: string;
  } | null;
}

export interface WorkflowArtifactsResponse {
  totalCount: number;
  artifacts: WorkflowArtifact[];
}