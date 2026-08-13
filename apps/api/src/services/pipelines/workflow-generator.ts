import type {
  FlutterPipelineConfig,
} from "@homemade-cicd/core";

import {
  createWorkflowTriggers,
  formatManagedWorkflow,
  type WorkflowStep,
} from "./workflow-format.js";

function createFlutterSetupSteps(
  includeJava = false,
): WorkflowStep[] {
  return [
    {
      name: "Checkout repository",
      uses: "actions/checkout@v4",
    },
    ...(includeJava
      ? [
          {
            name: "Set up Java",
            uses: "actions/setup-java@v4",
            with: {
              distribution: "temurin",
              "java-version": "17",
            },
          },
        ]
      : []),
    {
      name: "Set up Flutter",
      uses: "subosito/flutter-action@v2",
      with: {
        channel: "stable",
        cache: true,
      },
    },
    {
      name: "Install dependencies",
      run: "flutter pub get",
    },
  ];
}

function qualityDependency(enabled: boolean) {
  return enabled ? { needs: "quality" } : {};
}

export function generateFlutterWorkflow(
  config: FlutterPipelineConfig,
): string {
  const triggers = createWorkflowTriggers(
    config.branch,
    config.trigger,
  );

  const jobs: Record<string, unknown> = {};

  const qualityEnabled =
    config.checks.analyze || config.checks.test;

  if (qualityEnabled) {
    const qualitySteps = createFlutterSetupSteps();

    if (config.checks.analyze) {
      qualitySteps.push({
        name: "Analyze",
        run: "flutter analyze",
      });
    }

    if (config.checks.test) {
      qualitySteps.push({
        name: "Run tests",
        run: "flutter test",
      });
    }

    jobs.quality = {
      name: "Quality checks",
      "runs-on": "ubuntu-latest",
      steps: qualitySteps,
    };
  }

  if (
    config.android.enabled &&
    (config.android.apk || config.android.aab)
  ) {
    const androidSteps = createFlutterSetupSteps(true);

    if (config.android.apk) {
      androidSteps.push(
        {
          name: "Build APK",
          run: "flutter build apk --release",
        },
        {
          name: "Upload APK",
          uses: "actions/upload-artifact@v4",
          with: {
            name: "android-apk",
            path:
              "build/app/outputs/flutter-apk/app-release.apk",
          },
        },
      );
    }

    if (config.android.aab) {
      androidSteps.push(
        {
          name: "Build App Bundle",
          run: "flutter build appbundle --release",
        },
        {
          name: "Upload App Bundle",
          uses: "actions/upload-artifact@v4",
          with: {
            name: "android-aab",
            path:
              "build/app/outputs/bundle/release/app-release.aab",
          },
        },
      );
    }

    jobs.android = {
      name: "Android build",
      "runs-on": "ubuntu-latest",

      ...qualityDependency(qualityEnabled),

      steps: androidSteps,
    };
  }

  if (
    config.ios.enabled &&
    config.ios.unsignedBuild
  ) {
    jobs.ios = {
      name: "iOS build",
      "runs-on": "macos-latest",

      ...qualityDependency(qualityEnabled),

      steps: [
        ...createFlutterSetupSteps(),
        {
          name: "Build iOS without code signing",
          run:
            "flutter build ios --release --no-codesign",
        },
        {
          name: "Upload iOS application",
          uses: "actions/upload-artifact@v4",
          with: {
            name: "ios-unsigned",
            path: "build/ios/iphoneos/Runner.app",
          },
        },
      ],
    };
  }

  if (Object.keys(jobs).length === 0) {
    throw new Error(
      "Pipeline must contain at least one check or build.",
    );
  }

  const workflow = {
    name: "Homemade CI/CD",

    on: triggers,

    permissions: {
      contents: "read",
    },

    jobs,
  };

  return formatManagedWorkflow(
    "flutter",
    workflow,
    config.branch,
  );
}
