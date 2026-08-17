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

function legacyConfig(): FlutterPipelineConfig {
  return {
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
}

function signedConfig(): FlutterPipelineConfig {
  return {
    ...legacyConfig(),
    branch: "release/mobile",
    android: {
      enabled: true,
      apk: true,
      aab: true,
      signing: { enabled: true },
    },
    ios: {
      enabled: true,
      unsignedBuild: false,
      signedIpa: {
        enabled: true,
        teamId: "ABCDE12345",
        bundleId: "com.example.application",
        exportMethod: "ad-hoc",
      },
    },
  };
}

function roundTrip(
  config: FlutterPipelineConfig,
): FlutterPipelineConfig {
  return parseFlutterWorkflow(
    generateFlutterWorkflow(config),
    "fallback",
  );
}

describe("parseFlutterWorkflow", () => {
  it("round-trips a legacy unsigned Flutter pipeline", () => {
    const original = legacyConfig();

    expect(roundTrip(original)).toEqual(original);
  });

  it("preserves disabled legacy pipeline options", () => {
    const original: FlutterPipelineConfig = {
      ...legacyConfig(),
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

    expect(roundTrip(original)).toEqual(original);
  });

  it("round-trips Android and iOS signing config", () => {
    const original = signedConfig();

    expect(roundTrip(original)).toEqual(original);
  });

  it("round-trips Android-only signing", () => {
    const original: FlutterPipelineConfig = {
      ...legacyConfig(),
      android: {
        enabled: true,
        apk: false,
        aab: true,
        signing: { enabled: true },
      },
      ios: {
        enabled: false,
        unsignedBuild: false,
      },
    };

    expect(roundTrip(original)).toEqual(original);
  });

  it("round-trips iOS-only signing", () => {
    const original: FlutterPipelineConfig = {
      ...legacyConfig(),
      android: {
        enabled: false,
        apk: false,
        aab: false,
      },
      ios: {
        enabled: true,
        unsignedBuild: false,
        signedIpa: {
          enabled: true,
          teamId: "ABCDE12345",
          bundleId: "com.example.application",
          exportMethod: "development",
        },
      },
    };

    expect(roundTrip(original)).toEqual(original);
  });

  it("round-trips the default App Store export method", () => {
    const original = signedConfig();

    if (!original.ios.signedIpa) {
      throw new Error("Expected signed IPA config.");
    }

    original.ios.signedIpa.exportMethod =
      "app-store";

    expect(roundTrip(original)).toEqual(original);
  });

  it("preserves explicit disabled signing fields", () => {
    const original: FlutterPipelineConfig = {
      ...legacyConfig(),
      android: {
        enabled: true,
        apk: true,
        aab: false,
        signing: { enabled: false },
      },
      ios: {
        enabled: true,
        unsignedBuild: true,
        signedIpa: {
          enabled: false,
          teamId: "",
          bundleId: "",
          exportMethod: "app-store",
        },
      },
    };

    expect(roundTrip(original)).toEqual(original);
  });

  it("treats signed jobs as authoritative over stale disabled metadata", () => {
    const original = signedConfig();
    const yaml = generateFlutterWorkflow(original)
      .replace(
        /^# homemade-flutter-signing:.*$/mu,
        "# homemade-flutter-signing: {\"android\":{\"enabled\":false},\"ios\":{\"enabled\":false,\"teamId\":\"STALE00000\",\"bundleId\":\"com.stale.app\",\"exportMethod\":\"development\"}}",
      );

    expect(
      parseFlutterWorkflow(yaml, "fallback"),
    ).toEqual(original);
  });

  it("does not trust enabled metadata when signed jobs are absent", () => {
    const original = legacyConfig();
    const yaml = generateFlutterWorkflow(original)
      .replace(
        /^name:/mu,
        "# homemade-flutter-signing: {\"android\":{\"enabled\":true},\"ios\":{\"enabled\":true,\"teamId\":\"ABCDE12345\",\"bundleId\":\"com.example.application\",\"exportMethod\":\"app-store\"}}\nname:",
      );
    const parsed = parseFlutterWorkflow(
      yaml,
      "fallback",
    );

    expect(parsed.android.signing).toEqual({
      enabled: false,
    });
    expect(parsed.ios.signedIpa).toEqual({
      enabled: false,
      teamId: "ABCDE12345",
      bundleId: "com.example.application",
      exportMethod: "app-store",
    });
  });

  it("ignores marker-looking comments outside the managed header", () => {
    const original = legacyConfig();
    const fakeMarker =
      "# homemade-flutter-signing: {\"android\":{\"enabled\":true}}";
    const yaml = `${generateFlutterWorkflow(original)
      .replace(
        "        run: flutter analyze",
        [
          "        run: |-",
          "          echo safe",
          `          ${fakeMarker}`,
        ].join("\n"),
      )}\n${fakeMarker}\n`;

    const parsed = parseFlutterWorkflow(
      yaml,
      "fallback",
    );

    expect(parsed.android.signing).toBeUndefined();
    expect(parsed.ios.signedIpa).toBeUndefined();
  });
});
