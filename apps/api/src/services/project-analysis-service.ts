import {
  githubAdapter,
} from "../adapters/github/github-adapter.js";

import {
  detectProject,
} from "./project-detector.js";

export function inspectProject(
  owner: string,
  repo: string,
) {
  return detectProject(
    githubAdapter,
    owner,
    repo,
  );
}