import {
  describe,
  expect,
  it,
} from "vitest";

import {
  RELEASE_ARTIFACT_MAX_BYTES,
  createReleaseRequestSchema,
} from "@homemade-cicd/core";

function createManualDefaultBranchRequest() {
  return {
    tagName: "v1.2.0",
    name: "Version 1.2.0",
    notes: {
      mode: "manual" as const,
      body: "# Changes\n\n- First release\n",
    },
    draft: false,
    prerelease: false,
    source: {
      type: "defaultBranch" as const,
    },
  };
}

describe("release domain contracts", () => {
  it("uses the documented bounded artifact archive size", () => {
    expect(RELEASE_ARTIFACT_MAX_BYTES).toBe(
      100 * 1024 * 1024,
    );
  });

  it("accepts manual notes and preserves intentional tag and Markdown content", () => {
    const request = createManualDefaultBranchRequest();
    request.tagName = "  Release/Candidate-V1  ";
    request.notes.body = "  # Heading\n\nText  \n";

    const result = createReleaseRequestSchema.parse(
      request,
    );

    expect(result.tagName).toBe(
      "Release/Candidate-V1",
    );
    expect(result.notes).toEqual({
      mode: "manual",
      body: "  # Heading\n\nText  \n",
    });
  });

  it("accepts generated notes without a release name", () => {
    const result = createReleaseRequestSchema.parse({
      tagName: "v2.0.0",
      notes: {
        mode: "generated",
      },
      draft: false,
      prerelease: false,
      source: {
        type: "defaultBranch",
      },
    });

    expect(result).not.toHaveProperty("name");
    expect(result.notes).toEqual({
      mode: "generated",
    });
  });

  it.each([
    {
      description: "no selected artifacts",
      artifactIds: [],
    },
    {
      description: "multiple selected artifacts",
      artifactIds: [111, 222],
    },
  ])(
    "accepts a workflow-run source with $description",
    ({ artifactIds }) => {
      const result = createReleaseRequestSchema.parse({
        ...createManualDefaultBranchRequest(),
        source: {
          type: "workflowRun",
          runId: 123456,
          artifactIds,
        },
      });

      expect(result.source).toEqual({
        type: "workflowRun",
        runId: 123456,
        artifactIds,
      });
    },
  );

  it("accepts draft and prerelease together", () => {
    expect(
      createReleaseRequestSchema.safeParse({
        ...createManualDefaultBranchRequest(),
        draft: true,
        prerelease: true,
      }).success,
    ).toBe(true);
  });

  it.each(["", "   "])(
    "rejects an empty tag name",
    (tagName) => {
      expect(
        createReleaseRequestSchema.safeParse({
          ...createManualDefaultBranchRequest(),
          tagName,
        }).success,
      ).toBe(false);
    },
  );

  it("does not apply an incomplete custom Git tag regex", () => {
    expect(
      createReleaseRequestSchema.safeParse({
        ...createManualDefaultBranchRequest(),
        tagName: "Release Candidate/One",
      }).success,
    ).toBe(true);
  });

  it.each([
    {
      description: "generated notes carrying a body",
      notes: {
        mode: "generated",
        body: "",
      },
    },
    {
      description: "manual notes without a body",
      notes: {
        mode: "manual",
      },
    },
    {
      description: "an unknown notes mode",
      notes: {
        mode: "automatic",
      },
    },
  ])(
    "rejects $description",
    ({ notes }) => {
      expect(
        createReleaseRequestSchema.safeParse({
          ...createManualDefaultBranchRequest(),
          notes,
        }).success,
      ).toBe(false);
    },
  );

  it.each([
    {
      description: "a workflow run ID",
      source: {
        type: "defaultBranch",
        runId: 12,
      },
    },
    {
      description: "artifact IDs",
      source: {
        type: "defaultBranch",
        artifactIds: [12],
      },
    },
  ])(
    "rejects default-branch source carrying $description",
    ({ source }) => {
      expect(
        createReleaseRequestSchema.safeParse({
          ...createManualDefaultBranchRequest(),
          source,
        }).success,
      ).toBe(false);
    },
  );

  it.each([
    {
      description: "a missing run ID",
      source: {
        type: "workflowRun",
        artifactIds: [],
      },
    },
    {
      description: "a missing artifact ID array",
      source: {
        type: "workflowRun",
        runId: 1,
      },
    },
    {
      description: "a zero run ID",
      source: {
        type: "workflowRun",
        runId: 0,
        artifactIds: [],
      },
    },
    {
      description: "a fractional run ID",
      source: {
        type: "workflowRun",
        runId: 1.5,
        artifactIds: [],
      },
    },
    {
      description: "a string run ID",
      source: {
        type: "workflowRun",
        runId: "1",
        artifactIds: [],
      },
    },
    {
      description: "a negative artifact ID",
      source: {
        type: "workflowRun",
        runId: 1,
        artifactIds: [-1],
      },
    },
    {
      description: "a duplicate artifact ID",
      source: {
        type: "workflowRun",
        runId: 1,
        artifactIds: [2, 2],
      },
    },
  ])(
    "rejects workflow-run source with $description",
    ({ source }) => {
      expect(
        createReleaseRequestSchema.safeParse({
          ...createManualDefaultBranchRequest(),
          source,
        }).success,
      ).toBe(false);
    },
  );

  it.each([
    ["targetCommitSha", "abc123"],
    ["uploadUrl", "https://example.com/upload"],
    ["downloadUrl", "https://example.com/download"],
  ])(
    "rejects client-controlled orchestration field %s",
    (field, value) => {
      expect(
        createReleaseRequestSchema.safeParse({
          ...createManualDefaultBranchRequest(),
          [field]: value,
        }).success,
      ).toBe(false);
    },
  );

  it("rejects string booleans", () => {
    expect(
      createReleaseRequestSchema.safeParse({
        ...createManualDefaultBranchRequest(),
        draft: "false",
      }).success,
    ).toBe(false);
  });

  it("rejects a blank provided name but accepts an omitted name", () => {
    expect(
      createReleaseRequestSchema.safeParse({
        ...createManualDefaultBranchRequest(),
        name: "   ",
      }).success,
    ).toBe(false);

    const request = createManualDefaultBranchRequest();
    const { name: _name, ...withoutName } = request;

    expect(
      createReleaseRequestSchema.safeParse(
        withoutName,
      ).success,
    ).toBe(true);
  });
});
