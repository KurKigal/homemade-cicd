import {
  iosBundleIdSchema,
  iosTeamIdSchema,
  type AndroidSigningSecretsStatus,
  type AndroidSigningStatus,
  type IosSigningSecretsStatus,
  type IosSigningStatus,
  type RepositorySigningSecretsStatus,
  type RepositorySigningStatus,
} from "@homemade-cicd/core";

import type {
  RepositoryReader,
} from "../repositories/repository-reader.js";

const ANDROID_GROOVY_BUILD_FILE =
  "android/app/build.gradle";
const ANDROID_KOTLIN_BUILD_FILE =
  "android/app/build.gradle.kts";
const IOS_PROJECT_FILE =
  "ios/Runner.xcodeproj/project.pbxproj";

function stripSourceComments(source: string): string {
  return source
    .replace(/"""[\s\S]*?"""/gu, "")
    .replace(/'''[\s\S]*?'''/gu, "")
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/^\s*\/\/.*$/gmu, "")
    .replace(/\s+\/\/.*$/gmu, "");
}

function hasAndroidSigningConfiguration(
  source: string,
): boolean {
  const buildFile = stripSourceComments(source);
  const signingConfigsStart = buildFile.search(
    /\bsigningConfigs\s*\{/u,
  );
  const buildTypesOffset = signingConfigsStart < 0
    ? -1
    : buildFile.slice(signingConfigsStart)
        .search(/\bbuildTypes\s*\{/u);
  const buildTypesStart = buildTypesOffset < 0
    ? -1
    : signingConfigsStart + buildTypesOffset;
  const signingConfigsSection =
    signingConfigsStart >= 0 &&
    buildTypesStart > signingConfigsStart
      ? buildFile.slice(
          signingConfigsStart,
          buildTypesStart,
        )
      : "";
  const buildTypesSection = buildTypesStart >= 0
    ? buildFile.slice(buildTypesStart)
    : "";
  const hasKeyProperties =
    /\brootProject\s*\.\s*file\s*\(\s*["']key\.properties["']\s*\)/u
      .test(buildFile);
  const loadsKeyProperties =
    /\bkeystoreProperties\s*\.\s*load\s*\(/u
      .test(buildFile);
  const hasSigningConfigs =
    signingConfigsSection.length > 0;
  const hasReleaseDefinition =
    /\bcreate\s*\(\s*["']release["']\s*\)\s*\{/u
      .test(signingConfigsSection) ||
    /\brelease\s*\{/u.test(
      signingConfigsSection,
    );
  const hasReleaseBinding =
    /\bsigningConfig\s*(?:=\s*)?signingConfigs\s*(?:\.\s*release|\[\s*["']release["']\s*\]|\.\s*getByName\s*\(\s*["']release["']\s*\))/u
      .test(buildTypesSection);
  const hasReleaseBuildType =
    /\brelease\s*\{/u.test(buildTypesSection);
  const hasCredentialProperties = [
    "keyAlias",
    "keyPassword",
    "storeFile",
    "storePassword",
  ].every((property) =>
    new RegExp(
      `\\b${property}\\b\\s*=`,
      "u",
    ).test(signingConfigsSection),
  );

  return hasKeyProperties &&
    loadsKeyProperties &&
    hasSigningConfigs &&
    hasReleaseDefinition &&
    hasReleaseBuildType &&
    hasReleaseBinding &&
    hasCredentialProperties;
}

function allAndroidSecretsConfigured(
  status: AndroidSigningSecretsStatus,
): boolean {
  return status.keystore &&
    status.storePassword &&
    status.keyPassword &&
    status.keyAlias;
}

function allIosSecretsConfigured(
  status: IosSigningSecretsStatus,
): boolean {
  return status.certificate &&
    status.certificatePassword &&
    status.provisioningProfile;
}

function extractBuildSettingValues(
  project: string,
  setting: string,
): string[] {
  const pattern = new RegExp(
    `\\b${setting}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([^;\\r\\n]+))\\s*;`,
    "gu",
  );

  return Array.from(
    project.matchAll(pattern),
    (match) =>
      (match[1] ?? match[2] ?? match[3] ?? "")
        .trim(),
  );
}

function detectIosTeamId(
  project: string,
): string | null {
  const teamIds = new Set(
    extractBuildSettingValues(
      project,
      "DEVELOPMENT_TEAM",
    ).filter((value) =>
      iosTeamIdSchema.safeParse(value).success,
    ),
  );

  return teamIds.size === 1
    ? [...teamIds][0] ?? null
    : null;
}

function isTestBundleId(value: string): boolean {
  return /(?:^|\.)(?:runner)?(?:ui)?tests$/iu
    .test(value);
}

function detectIosBundleId(
  project: string,
): string | null {
  const bundleIds = new Set(
    extractBuildSettingValues(
      project,
      "PRODUCT_BUNDLE_IDENTIFIER",
    ).filter((value) =>
      !isTestBundleId(value) &&
      iosBundleIdSchema.safeParse(value).success,
    ),
  );

  return bundleIds.size === 1
    ? [...bundleIds][0] ?? null
    : null;
}

function hasIosSigningConfiguration(
  project: string,
): boolean {
  return extractBuildSettingValues(
    project,
    "CODE_SIGN_STYLE",
  ).some((value) =>
    value === "Automatic" || value === "Manual",
  );
}

function createEmptySigningSecretsStatus(): RepositorySigningSecretsStatus {
  return {
    android: {
      keystore: false,
      storePassword: false,
      keyPassword: false,
      keyAlias: false,
    },
    ios: {
      certificate: false,
      certificatePassword: false,
      provisioningProfile: false,
    },
  };
}

export async function inspectAndroidSigningReadiness(
  reader: RepositoryReader,
  owner: string,
  repo: string,
  secrets: AndroidSigningSecretsStatus,
): Promise<AndroidSigningStatus> {
  const platformPresent = await reader.pathExists(
    owner,
    repo,
    "android",
  );
  const credentialsReady =
    allAndroidSecretsConfigured(secrets);
  const issues: string[] = [];

  if (!platformPresent) {
    issues.push(
      "Android platform directory is missing.",
    );
  }

  const buildFiles: Array<string | null> = platformPresent
    ? await Promise.all([
        reader.readTextFile(
          owner,
          repo,
          ANDROID_GROOVY_BUILD_FILE,
        ),
        reader.readTextFile(
          owner,
          repo,
          ANDROID_KOTLIN_BUILD_FILE,
        ),
      ])
    : [null, null];
  const readableBuildFiles = buildFiles.filter(
    (source): source is string => source !== null,
  );
  const projectReady =
    platformPresent &&
    readableBuildFiles.some(
      hasAndroidSigningConfiguration,
    );

  if (
    platformPresent &&
    readableBuildFiles.length === 0
  ) {
    issues.push(
      "Android app Gradle build file could not be read.",
    );
  } else if (platformPresent && !projectReady) {
    issues.push(
      "Android release signing configuration was not detected in the Gradle build file.",
    );
  }

  if (!credentialsReady) {
    issues.push(
      "Android signing credentials are missing.",
    );
  }

  return {
    platformPresent,
    projectReady,
    credentialsReady,
    ready: projectReady && credentialsReady,
    issues,
    secrets,
  };
}

export async function inspectIosSigningReadiness(
  reader: RepositoryReader,
  owner: string,
  repo: string,
  secrets: IosSigningSecretsStatus,
): Promise<IosSigningStatus> {
  const platformPresent = await reader.pathExists(
    owner,
    repo,
    "ios",
  );
  const credentialsReady =
    allIosSecretsConfigured(secrets);
  const issues: string[] = [];

  if (!platformPresent) {
    issues.push(
      "iOS platform directory is missing.",
    );
  }

  const projectFile = platformPresent
    ? await reader.readTextFile(
        owner,
        repo,
        IOS_PROJECT_FILE,
      )
    : null;
  const normalizedProject = projectFile === null
    ? null
    : stripSourceComments(projectFile);
  const detectedTeamId = normalizedProject === null
    ? null
    : detectIosTeamId(normalizedProject);
  const detectedBundleId = normalizedProject === null
    ? null
    : detectIosBundleId(normalizedProject);
  const signingConfigured = normalizedProject !== null &&
    hasIosSigningConfiguration(normalizedProject);
  const projectReady = platformPresent &&
    detectedTeamId !== null &&
    detectedBundleId !== null &&
    signingConfigured;

  if (platformPresent && projectFile === null) {
    issues.push(
      "iOS Runner Xcode project could not be read.",
    );
  } else if (platformPresent) {
    if (detectedTeamId === null) {
      issues.push(
        "Development Team could not be detected.",
      );
    }

    if (detectedBundleId === null) {
      issues.push(
        "Runner bundle identifier could not be detected.",
      );
    }

    if (!signingConfigured) {
      issues.push(
        "Xcode code-signing configuration could not be detected.",
      );
    }
  }

  if (!credentialsReady) {
    issues.push(
      "iOS signing credentials are missing.",
    );
  }

  return {
    platformPresent,
    projectReady,
    credentialsReady,
    ready: projectReady && credentialsReady,
    issues,
    detectedTeamId,
    detectedBundleId,
    secrets,
  };
}

export async function inspectSigningReadiness(
  reader: RepositoryReader,
  owner: string,
  repo: string,
  secrets: RepositorySigningSecretsStatus =
    createEmptySigningSecretsStatus(),
): Promise<RepositorySigningStatus> {
  const [android, ios] = await Promise.all([
    inspectAndroidSigningReadiness(
      reader,
      owner,
      repo,
      secrets.android,
    ),
    inspectIosSigningReadiness(
      reader,
      owner,
      repo,
      secrets.ios,
    ),
  ]);

  return {
    android,
    ios,
  };
}
