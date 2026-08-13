import YAML from "yaml";

export type UnknownRecord =
  Record<string, unknown>;

export function asRecord(
  value: unknown,
): UnknownRecord | null {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as UnknownRecord;
}

export function asArray(
  value: unknown,
): unknown[] {
  return Array.isArray(value)
    ? value
    : [];
}

export function parseWorkflowRoot(
  yaml: string,
): UnknownRecord {
  const root = asRecord(
    YAML.parse(yaml) as unknown,
  );

  if (!root) {
    throw new Error(
      "Workflow YAML is not a valid object.",
    );
  }

  return root;
}

export function readSteps(
  job: unknown,
): UnknownRecord[] {
  const jobRecord = asRecord(job);

  if (!jobRecord) {
    return [];
  }

  return asArray(jobRecord.steps)
    .map((step) => asRecord(step))
    .filter(
      (step): step is UnknownRecord =>
        step !== null,
    );
}

export function readCommands(
  job: unknown,
): string[] {
  return readSteps(job)
    .map((step) => step.run)
    .filter(
      (run): run is string =>
        typeof run === "string",
    );
}

export function containsCommand(
  commands: string[],
  expected: string,
): boolean {
  return commands.some(
    (command) => command.trim() === expected,
  );
}

export function firstBranch(
  trigger: unknown,
): string | null {
  const triggerRecord = asRecord(trigger);

  if (!triggerRecord) {
    return null;
  }

  const branches = triggerRecord.branches;

  if (typeof branches === "string") {
    return branches;
  }

  if (Array.isArray(branches)) {
    const branch = branches.find(
      (item) => typeof item === "string",
    );

    return typeof branch === "string"
      ? branch
      : null;
  }

  return null;
}
