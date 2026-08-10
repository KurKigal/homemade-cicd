import {
  githubAdapter,
} from "../../adapters/github/github-adapter.js";

export function getAuthenticatedGitHubUser() {
  return githubAdapter.getAuthenticatedUser();
}

export function listGitHubRepositories() {
  return githubAdapter.listRepositories();
}