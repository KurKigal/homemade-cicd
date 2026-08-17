import {
  describe,
  expect,
  it,
} from "vitest";

import {
  GITHUB_ACTIONS_SECRET_MAX_BYTES,
  SIGNING_SECRET_NAMES,
  androidSigningCredentialsRequestSchema,
  flutterPipelineSchema,
  iosSigningCredentialsRequestSchema,
  repositorySigningStatusSchema,
  type AndroidSigningSecretsStatus,
  type IosSigningSecretsStatus,
} from "@homemade-cicd/core";

import {
  inspectAndroidSigningReadiness,
  inspectIosSigningReadiness,
  inspectSigningReadiness,
} from "./signing-readiness.js";

import type {
  RepositoryReader,
} from "../repositories/repository-reader.js";

const allAndroidSecrets: AndroidSigningSecretsStatus = {
  keystore: true,
  storePassword: true,
  keyPassword: true,
  keyAlias: true,
};

const noAndroidSecrets: AndroidSigningSecretsStatus = {
  keystore: false,
  storePassword: false,
  keyPassword: false,
  keyAlias: false,
};

const allIosSecrets: IosSigningSecretsStatus = {
  certificate: true,
  certificatePassword: true,
  provisioningProfile: true,
};

const noIosSecrets: IosSigningSecretsStatus = {
  certificate: false,
  certificatePassword: false,
  provisioningProfile: false,
};

const groovySigningBuild = `
def keystorePropertiesFile = rootProject.file('key.properties')
keystoreProperties.load(new FileInputStream(keystorePropertiesFile))

android {
  signingConfigs {
    release {
      keyAlias = keystoreProperties['keyAlias']
      keyPassword = keystoreProperties['keyPassword']
      storeFile = file(keystoreProperties['storeFile'])
      storePassword = keystoreProperties['storePassword']
    }
  }
  buildTypes {
    release {
      signingConfig = signingConfigs.release
    }
  }
}
`;

const kotlinSigningBuild = `
val keystorePropertiesFile = rootProject.file("key.properties")
keystoreProperties.load(FileInputStream(keystorePropertiesFile))

android {
  signingConfigs {
    create("release") {
      keyAlias = keystoreProperties["keyAlias"] as String
      keyPassword = keystoreProperties["keyPassword"] as String
      storeFile = file(keystoreProperties["storeFile"] as String)
      storePassword = keystoreProperties["storePassword"] as String
    }
  }
  buildTypes {
    release {
      signingConfig = signingConfigs.getByName("release")
    }
  }
}
`;

const readyIosProject = `
/* PRODUCT_BUNDLE_IDENTIFIER = com.comment.fake; */
buildSettings = {
  CODE_SIGN_STYLE = Automatic;
  DEVELOPMENT_TEAM = ABCDE12345;
  PRODUCT_BUNDLE_IDENTIFIER = com.example.app.RunnerTests;
};
buildSettings = {
  CODE_SIGN_STYLE = Automatic;
  DEVELOPMENT_TEAM = ABCDE12345;
  PRODUCT_BUNDLE_IDENTIFIER = com.example.app;
};
`;

class FakeRepositoryReader
  implements RepositoryReader
{
  constructor(
    private readonly paths: string[],
    private readonly files: Record<string, string> = {},
  ) {}

  async listRootEntryNames(): Promise<Set<string>> {
    return new Set();
  }

  async readTextFile(
    _owner: string,
    _repo: string,
    path: string,
  ): Promise<string | null> {
    return this.files[path] ?? null;
  }

  async pathExists(
    _owner: string,
    _repo: string,
    path: string,
  ): Promise<boolean> {
    return this.paths.includes(path);
  }
}

function createLegacyFlutterConfig() {
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
      aab: false,
    },
    ios: {
      enabled: true,
      unsignedBuild: true,
    },
  };
}

describe("signing domain contracts", () => {
  it("keeps the canonical GitHub secret names in one contract", () => {
    expect(SIGNING_SECRET_NAMES).toEqual({
      android: {
        keystore:
          "HOMEMADE_ANDROID_KEYSTORE_BASE64",
        storePassword:
          "HOMEMADE_ANDROID_STORE_PASSWORD",
        keyPassword:
          "HOMEMADE_ANDROID_KEY_PASSWORD",
        keyAlias:
          "HOMEMADE_ANDROID_KEY_ALIAS",
      },
      ios: {
        certificate:
          "HOMEMADE_IOS_CERTIFICATE_P12_BASE64",
        certificatePassword:
          "HOMEMADE_IOS_CERTIFICATE_PASSWORD",
        provisioningProfile:
          "HOMEMADE_IOS_PROVISIONING_PROFILE_BASE64",
      },
    });
  });

  it("continues to accept legacy unsigned Flutter configs", () => {
    expect(
      flutterPipelineSchema.parse(
        createLegacyFlutterConfig(),
      ),
    ).toEqual(createLegacyFlutterConfig());
  });

  it("accepts signed Flutter config and canonicalizes iOS identifiers", () => {
    const result = flutterPipelineSchema.parse({
      ...createLegacyFlutterConfig(),
      android: {
        enabled: true,
        apk: true,
        aab: true,
        signing: {
          enabled: true,
        },
      },
      ios: {
        enabled: true,
        unsignedBuild: false,
        signedIpa: {
          enabled: true,
          teamId: " ABCDE12345 ",
          bundleId: " com.example.app ",
          exportMethod: "app-store",
        },
      },
    });

    expect(result.ios.signedIpa).toMatchObject({
      teamId: "ABCDE12345",
      bundleId: "com.example.app",
    });
  });

  it("allows an explicit disabled signing form with empty iOS fields", () => {
    expect(
      flutterPipelineSchema.safeParse({
        ...createLegacyFlutterConfig(),
        android: {
          enabled: true,
          apk: true,
          aab: false,
          signing: {
            enabled: false,
          },
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
      }).success,
    ).toBe(true);
  });

  it("rejects credential values embedded in non-secret pipeline config", () => {
    expect(
      flutterPipelineSchema.safeParse({
        ...createLegacyFlutterConfig(),
        android: {
          enabled: true,
          apk: true,
          aab: false,
          signing: {
            enabled: true,
            storePassword: "must-not-enter-config",
          },
        },
      }).success,
    ).toBe(false);
  });

  it.each([
    {
      description: "Android platform disabled",
      config: {
        ...createLegacyFlutterConfig(),
        android: {
          enabled: false,
          apk: true,
          aab: false,
          signing: { enabled: true },
        },
      },
    },
    {
      description: "no signed Android artifact",
      config: {
        ...createLegacyFlutterConfig(),
        android: {
          enabled: true,
          apk: false,
          aab: false,
          signing: { enabled: true },
        },
      },
    },
    {
      description: "unsigned and signed iOS together",
      config: {
        ...createLegacyFlutterConfig(),
        ios: {
          enabled: true,
          unsignedBuild: true,
          signedIpa: {
            enabled: true,
            teamId: "ABCDE12345",
            bundleId: "com.example.app",
            exportMethod: "app-store" as const,
          },
        },
      },
    },
    {
      description: "invalid iOS identifiers",
      config: {
        ...createLegacyFlutterConfig(),
        ios: {
          enabled: true,
          unsignedBuild: false,
          signedIpa: {
            enabled: true,
            teamId: "bad-team",
            bundleId: "not-a-bundle-id",
            exportMethod: "app-store" as const,
          },
        },
      },
    },
  ])(
    "rejects invalid signing config: $description",
    ({ config }) => {
      expect(
        flutterPipelineSchema.safeParse(config).success,
      ).toBe(false);
    },
  );

  it("validates base64 credential requests and the 48 KB encoded limit", () => {
    const exactLimit = "A".repeat(
      GITHUB_ACTIONS_SECRET_MAX_BYTES,
    );
    const oversized = `${exactLimit}AAAA`;

    expect(
      androidSigningCredentialsRequestSchema.safeParse({
        keystoreBase64: exactLimit,
        storePassword: "store-secret",
        keyPassword: "key-secret",
        keyAlias: "upload",
      }).success,
    ).toBe(true);

    expect(
      androidSigningCredentialsRequestSchema.safeParse({
        keystoreBase64: oversized,
        storePassword: "store-secret",
        keyPassword: "key-secret",
        keyAlias: "upload",
      }).success,
    ).toBe(false);

    expect(
      iosSigningCredentialsRequestSchema.safeParse({
        certificateP12Base64: "not base64",
        certificatePassword: "secret",
        provisioningProfileBase64: "cHJvZmlsZQ==",
      }).success,
    ).toBe(false);

    expect(
      androidSigningCredentialsRequestSchema.safeParse({
        keystoreBase64: "a2V5c3RvcmU=",
        storePassword: "store-secret",
        keyPassword: "key-secret",
        keyAlias: "   ",
      }).success,
    ).toBe(false);
  });

  it("rejects accidental secret values in a signing status response", () => {
    const result = repositorySigningStatusSchema.safeParse({
      android: {
        platformPresent: true,
        projectReady: true,
        credentialsReady: true,
        ready: true,
        issues: [],
        secrets: {
          ...allAndroidSecrets,
          keystoreValue: "must-not-leak",
        },
      },
      ios: {
        platformPresent: false,
        projectReady: false,
        credentialsReady: false,
        ready: false,
        issues: [],
        detectedTeamId: null,
        detectedBundleId: null,
        secrets: noIosSecrets,
      },
    });

    expect(result.success).toBe(false);
  });
});

describe("Android signing readiness", () => {
  it("detects the official Groovy release-signing structure", async () => {
    const status = await inspectAndroidSigningReadiness(
      new FakeRepositoryReader(
        ["android"],
        {
          "android/app/build.gradle":
            groovySigningBuild,
        },
      ),
      "example",
      "flutter-app",
      allAndroidSecrets,
    );

    expect(status).toEqual({
      platformPresent: true,
      projectReady: true,
      credentialsReady: true,
      ready: true,
      issues: [],
      secrets: allAndroidSecrets,
    });
  });

  it("detects the official Kotlin DSL release-signing structure", async () => {
    const status = await inspectAndroidSigningReadiness(
      new FakeRepositoryReader(
        ["android"],
        {
          "android/app/build.gradle.kts":
            kotlinSigningBuild,
        },
      ),
      "example",
      "flutter-app",
      allAndroidSecrets,
    );

    expect(status.projectReady).toBe(true);
    expect(status.ready).toBe(true);
  });

  it("does not treat commented or incomplete Gradle examples as ready", async () => {
    const status = await inspectAndroidSigningReadiness(
      new FakeRepositoryReader(
        ["android"],
        {
          "android/app/build.gradle.kts": `
/*
${kotlinSigningBuild}
*/
android {
  signingConfigs {}
  buildTypes { release {} }
}
`,
        },
      ),
      "example",
      "flutter-app",
      allAndroidSecrets,
    );

    expect(status.projectReady).toBe(false);
    expect(status.ready).toBe(false);
    expect(status.issues).toContain(
      "Android release signing configuration was not detected in the Gradle build file.",
    );
  });

  it("does not detect signing instructions embedded in a multiline string", async () => {
    const status = await inspectAndroidSigningReadiness(
      new FakeRepositoryReader(
        ["android"],
        {
          "android/app/build.gradle.kts": `
val documentation = """
${kotlinSigningBuild}
"""
android { buildTypes { release {} } }
`,
        },
      ),
      "example",
      "flutter-app",
      allAndroidSecrets,
    );

    expect(status.projectReady).toBe(false);
  });

  it("does not combine a debug signing config with a release build block", async () => {
    const status = await inspectAndroidSigningReadiness(
      new FakeRepositoryReader(
        ["android"],
        {
          "android/app/build.gradle": `
def keystorePropertiesFile = rootProject.file('key.properties')
keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
android {
  signingConfigs {
    debug {
      keyAlias = keystoreProperties['keyAlias']
      keyPassword = keystoreProperties['keyPassword']
      storeFile = file(keystoreProperties['storeFile'])
      storePassword = keystoreProperties['storePassword']
    }
  }
  buildTypes {
    release {
      signingConfig = signingConfigs.release
    }
  }
}
`,
        },
      ),
      "example",
      "flutter-app",
      allAndroidSecrets,
    );

    expect(status.projectReady).toBe(false);
  });

  it("reports a partial credential set without exposing values", async () => {
    const status = await inspectAndroidSigningReadiness(
      new FakeRepositoryReader(
        ["android"],
        {
          "android/app/build.gradle":
            groovySigningBuild,
        },
      ),
      "example",
      "flutter-app",
      {
        ...allAndroidSecrets,
        keyAlias: false,
      },
    );

    expect(status.projectReady).toBe(true);
    expect(status.credentialsReady).toBe(false);
    expect(status.ready).toBe(false);
    expect(status.issues).toContain(
      "Android signing credentials are missing.",
    );
  });
});

describe("iOS signing readiness", () => {
  it("detects team, Runner bundle ID and signing metadata", async () => {
    const status = await inspectIosSigningReadiness(
      new FakeRepositoryReader(
        ["ios"],
        {
          "ios/Runner.xcodeproj/project.pbxproj":
            readyIosProject,
        },
      ),
      "example",
      "flutter-app",
      allIosSecrets,
    );

    expect(status).toEqual({
      platformPresent: true,
      projectReady: true,
      credentialsReady: true,
      ready: true,
      issues: [],
      detectedTeamId: "ABCDE12345",
      detectedBundleId: "com.example.app",
      secrets: allIosSecrets,
    });
  });

  it("reports a missing Development Team conservatively", async () => {
    const status = await inspectIosSigningReadiness(
      new FakeRepositoryReader(
        ["ios"],
        {
          "ios/Runner.xcodeproj/project.pbxproj": `
buildSettings = {
  CODE_SIGN_STYLE = Automatic;
  PRODUCT_BUNDLE_IDENTIFIER = com.example.app;
};
`,
        },
      ),
      "example",
      "flutter-app",
      allIosSecrets,
    );

    expect(status.detectedTeamId).toBeNull();
    expect(status.detectedBundleId).toBe(
      "com.example.app",
    );
    expect(status.projectReady).toBe(false);
    expect(status.issues).toContain(
      "Development Team could not be detected.",
    );
  });

  it("does not guess between ambiguous non-test bundle identifiers", async () => {
    const status = await inspectIosSigningReadiness(
      new FakeRepositoryReader(
        ["ios"],
        {
          "ios/Runner.xcodeproj/project.pbxproj": `
buildSettings = {
  CODE_SIGN_STYLE = Automatic;
  DEVELOPMENT_TEAM = ABCDE12345;
  PRODUCT_BUNDLE_IDENTIFIER = com.example.app;
};
buildSettings = {
  CODE_SIGN_STYLE = Automatic;
  DEVELOPMENT_TEAM = ABCDE12345;
  PRODUCT_BUNDLE_IDENTIFIER = com.example.extension;
};
`,
        },
      ),
      "example",
      "flutter-app",
      allIosSecrets,
    );

    expect(status.detectedBundleId).toBeNull();
    expect(status.projectReady).toBe(false);
  });

  it("reports a missing iOS platform without inferring metadata", async () => {
    const status = await inspectIosSigningReadiness(
      new FakeRepositoryReader([]),
      "example",
      "flutter-app",
      allIosSecrets,
    );

    expect(status).toMatchObject({
      platformPresent: false,
      projectReady: false,
      credentialsReady: true,
      ready: false,
      detectedTeamId: null,
      detectedBundleId: null,
    });
    expect(status.issues).toEqual([
      "iOS platform directory is missing.",
    ]);
  });
});

describe("repository signing readiness", () => {
  it("combines project metadata and platform secret status", async () => {
    const status = await inspectSigningReadiness(
      new FakeRepositoryReader(
        ["android", "ios"],
        {
          "android/app/build.gradle":
            groovySigningBuild,
          "ios/Runner.xcodeproj/project.pbxproj":
            readyIosProject,
        },
      ),
      "example",
      "flutter-app",
      {
        android: allAndroidSecrets,
        ios: noIosSecrets,
      },
    );

    expect(status.android.ready).toBe(true);
    expect(status.ios).toMatchObject({
      projectReady: true,
      credentialsReady: false,
      ready: false,
    });
    expect(
      repositorySigningStatusSchema.safeParse(status)
        .success,
    ).toBe(true);
  });

  it("uses a safe all-missing secret status by default", async () => {
    const status = await inspectSigningReadiness(
      new FakeRepositoryReader([]),
      "example",
      "flutter-app",
    );

    expect(status.android.secrets).toEqual(
      noAndroidSecrets,
    );
    expect(status.ios.secrets).toEqual(
      noIosSecrets,
    );
  });
});
