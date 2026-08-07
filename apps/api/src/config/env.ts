import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

const envPath = path.resolve(currentDir, "../../.env");

try {
  loadEnvFile(envPath);
} catch {
  throw new Error(
    `Could not load environment file: ${envPath}`
  );
}

const githubToken = process.env.GITHUB_TOKEN;

if (!githubToken) {
  throw new Error(
    "GITHUB_TOKEN is missing. Define it in apps/api/.env"
  );
}

export const env = {
  githubToken,
};