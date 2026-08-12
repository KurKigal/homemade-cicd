import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  FlutterPipelineConfig,
} from "@homemade-cicd/core";

import {
  generateFlutterWorkflow,
} from "./workflow-generator.js";

import {
  parseFlutterWorkflow,
} from "./workflow-parser.js";

describe(
  "parseFlutterWorkflow",
  () => {
    it(
      "round-trips a complete Flutter pipeline",
      () => {
        const original: FlutterPipelineConfig =
          {
            branch: "main",

            trigger: {
              push: true,
              pullRequest: true,
              manual: true,
            },

            checks: {
              analyze: true,
              test: true,
            },

            android: {
              enabled: true,
              apk: true,
              aab: true,
            },

            ios: {
              enabled: true,
              unsignedBuild: true,
            },
          };

        const yaml =
          generateFlutterWorkflow(
            original,
          );

        const parsed =
          parseFlutterWorkflow(
            yaml,
            "main",
          );

        expect(parsed).toEqual(
          original,
        );
      },
    );

    it(
      "preserves disabled pipeline options",
      () => {
        const original: FlutterPipelineConfig =
          {
            branch: "develop",

            trigger: {
              push: true,
              pullRequest: false,
              manual: true,
            },

            checks: {
              analyze: true,
              test: false,
            },

            android: {
              enabled: true,
              apk: true,
              aab: false,
            },

            ios: {
              enabled: false,
              unsignedBuild: false,
            },
          };

        const yaml =
          generateFlutterWorkflow(
            original,
          );

        const parsed =
          parseFlutterWorkflow(
            yaml,
            "main",
          );

        expect(parsed).toEqual(
          original,
        );
      },
    );
  },
);