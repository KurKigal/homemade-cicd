import { Octokit } from "octokit";
import { env } from "../config/env.js";

export const github = new Octokit({
  auth: env.githubToken,
  request: {
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  },
});