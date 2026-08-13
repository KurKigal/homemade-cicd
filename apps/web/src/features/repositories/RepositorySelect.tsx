import type { Repository } from "@homemade-cicd/core";

interface RepositorySelectProps {
  owner?: string;
  repo?: string;
  repositories: Repository[];
  onChange: (fullName: string) => void;
}

export function RepositorySelect({
  owner,
  repo,
  repositories,
  onChange,
}: RepositorySelectProps) {
  return (
    <select
      value={owner && repo ? `${owner}/${repo}` : ""}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 min-w-72 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
    >
      <option value="">Select repository</option>

      {repositories.map((repository) => (
        <option key={repository.id} value={repository.fullName}>
          {repository.fullName}
        </option>
      ))}
    </select>
  );
}
