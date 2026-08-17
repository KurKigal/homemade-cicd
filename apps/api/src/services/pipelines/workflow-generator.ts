import {
  SIGNING_SECRET_NAMES,
  type FlutterPipelineConfig,
  type IosExportMethod,
} from "@homemade-cicd/core";

import {
  createFlutterSigningMarker,
  createWorkflowTriggers,
  formatManagedWorkflow,
  type WorkflowStep,
} from "./workflow-format.js";

const SIGNING_JOB_CONDITION =
  "github.event_name != 'pull_request'";

const ALWAYS_CONDITION = "${{ always() }}";

function secretReference(
  secretName: string,
): string {
  return `\${{ secrets.${secretName} }}`;
}

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

function createAndroidSigningEnvironment(): Record<
  string,
  string
> {
  return {
    ANDROID_KEYSTORE_BASE64:
      secretReference(
        SIGNING_SECRET_NAMES.android.keystore,
      ),
    ANDROID_STORE_PASSWORD:
      secretReference(
        SIGNING_SECRET_NAMES.android.storePassword,
      ),
    ANDROID_KEY_PASSWORD:
      secretReference(
        SIGNING_SECRET_NAMES.android.keyPassword,
      ),
    ANDROID_KEY_ALIAS:
      secretReference(
        SIGNING_SECRET_NAMES.android.keyAlias,
      ),
  };
}

function createAndroidSigningSteps(
  config: FlutterPipelineConfig,
): WorkflowStep[] {
  const steps = createFlutterSetupSteps(true);

  steps.push({
    name: "Prepare Android signing material",
    env: createAndroidSigningEnvironment(),
    run: [
      "set -euo pipefail",
      "",
      "if [[ -z \"$ANDROID_KEYSTORE_BASE64\" || -z \"$ANDROID_STORE_PASSWORD\" || -z \"$ANDROID_KEY_PASSWORD\" || -z \"$ANDROID_KEY_ALIAS\" ]]; then",
      "  echo \"::error::Android signing credentials are incomplete.\"",
      "  exit 1",
      "fi",
      "",
      "KEYSTORE_PATH=\"$RUNNER_TEMP/homemade-android-release.keystore\"",
      "KEY_PROPERTIES_WRITER=\"$RUNNER_TEMP/HomemadeKeyProperties.java\"",
      "umask 077",
      "printf '%s' \"$ANDROID_KEYSTORE_BASE64\" | base64 --decode > \"$KEYSTORE_PATH\"",
      "keytool -list -alias \"$ANDROID_KEY_ALIAS\" -keystore \"$KEYSTORE_PATH\" -storepass:env ANDROID_STORE_PASSWORD > /dev/null",
      "export ANDROID_KEYSTORE_PATH=\"$KEYSTORE_PATH\"",
      "cat > \"$KEY_PROPERTIES_WRITER\" <<'JAVA'",
      "import java.io.OutputStream;",
      "import java.nio.file.Files;",
      "import java.nio.file.Path;",
      "import java.util.Properties;",
      "",
      "public class HomemadeKeyProperties {",
      "  public static void main(String[] args) throws Exception {",
      "    Properties properties = new Properties();",
      "    properties.setProperty(\"storePassword\", System.getenv(\"ANDROID_STORE_PASSWORD\"));",
      "    properties.setProperty(\"keyPassword\", System.getenv(\"ANDROID_KEY_PASSWORD\"));",
      "    properties.setProperty(\"keyAlias\", System.getenv(\"ANDROID_KEY_ALIAS\"));",
      "    properties.setProperty(\"storeFile\", System.getenv(\"ANDROID_KEYSTORE_PATH\"));",
      "",
      "    try (OutputStream output = Files.newOutputStream(Path.of(\"android/key.properties\"))) {",
      "      properties.store(output, null);",
      "    }",
      "  }",
      "}",
      "JAVA",
      "java \"$KEY_PROPERTIES_WRITER\"",
      "chmod 600 \"$KEYSTORE_PATH\" android/key.properties",
    ].join("\n"),
  });

  if (config.android.apk) {
    steps.push(
      {
        name: "Build signed APK",
        run: "flutter build apk --release",
      },
      {
        name: "Verify signed APK",
        run: [
          "set -euo pipefail",
          "APK_PATH=\"build/app/outputs/flutter-apk/app-release.apk\"",
          "ANDROID_SDK_PATH=\"${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}\"",
          "",
          "if [[ -z \"$ANDROID_SDK_PATH\" ]]; then",
          "  echo \"::error::Android SDK is unavailable.\"",
          "  exit 1",
          "fi",
          "",
          "APKSIGNER_PATH=\"$(find \"$ANDROID_SDK_PATH/build-tools\" -type f -name apksigner -print | sort -V | tail -n 1)\"",
          "if [[ -z \"$APKSIGNER_PATH\" ]]; then",
          "  echo \"::error::Android SDK apksigner was not found.\"",
          "  exit 1",
          "fi",
          "",
          "\"$APKSIGNER_PATH\" verify --verbose \"$APK_PATH\"",
        ].join("\n"),
      },
      {
        name: "Upload signed APK",
        uses: "actions/upload-artifact@v4",
        with: {
          name: "android-apk-signed",
          path:
            "build/app/outputs/flutter-apk/app-release.apk",
        },
      },
    );
  }

  if (config.android.aab) {
    steps.push(
      {
        name: "Build signed App Bundle",
        run: "flutter build appbundle --release",
      },
      {
        name: "Verify signed App Bundle",
        run: [
          "set -euo pipefail",
          "AAB_PATH=\"build/app/outputs/bundle/release/app-release.aab\"",
          "jarsigner -verify \"$AAB_PATH\"",
          "keytool -printcert -jarfile \"$AAB_PATH\" > /dev/null",
        ].join("\n"),
      },
      {
        name: "Upload signed App Bundle",
        uses: "actions/upload-artifact@v4",
        with: {
          name: "android-aab-signed",
          path:
            "build/app/outputs/bundle/release/app-release.aab",
        },
      },
    );
  }

  steps.push({
    name: "Clean up Android signing material",
    if: ALWAYS_CONDITION,
    run: [
      "rm -f android/key.properties",
      "rm -f \"$RUNNER_TEMP/homemade-android-release.keystore\"",
      "rm -f \"$RUNNER_TEMP/HomemadeKeyProperties.java\"",
    ].join("\n"),
  });

  return steps;
}

function createIosSigningEnvironment(): Record<
  string,
  string
> {
  return {
    IOS_CERTIFICATE_P12_BASE64:
      secretReference(
        SIGNING_SECRET_NAMES.ios.certificate,
      ),
    IOS_CERTIFICATE_PASSWORD:
      secretReference(
        SIGNING_SECRET_NAMES.ios.certificatePassword,
      ),
    IOS_PROVISIONING_PROFILE_BASE64:
      secretReference(
        SIGNING_SECRET_NAMES.ios.provisioningProfile,
      ),
  };
}

function createIosBuildCommand(
  exportMethod: IosExportMethod,
): string {
  if (exportMethod === "app-store") {
    return "flutter build ipa --release";
  }

  return `flutter build ipa --release --export-method ${exportMethod}`;
}

function createIosSigningSteps(
  config: FlutterPipelineConfig,
): WorkflowStep[] {
  const signedIpa = config.ios.signedIpa;

  if (!signedIpa?.enabled) {
    return [];
  }

  return [
    ...createFlutterSetupSteps(),
    {
      name: "Prepare iOS signing material",
      env: {
        ...createIosSigningEnvironment(),
        EXPECTED_TEAM_ID: signedIpa.teamId,
        EXPECTED_BUNDLE_ID: signedIpa.bundleId,
      },
      run: [
        "set -euo pipefail",
        "",
        "if [[ -z \"$IOS_CERTIFICATE_P12_BASE64\" || -z \"$IOS_CERTIFICATE_PASSWORD\" || -z \"$IOS_PROVISIONING_PROFILE_BASE64\" ]]; then",
        "  echo \"::error::iOS signing credentials are incomplete.\"",
        "  exit 1",
        "fi",
        "",
        "SIGNING_DIR=\"$RUNNER_TEMP/homemade-ios-signing\"",
        "CERTIFICATE_PATH=\"$SIGNING_DIR/distribution.p12\"",
        "PROFILE_PATH=\"$SIGNING_DIR/profile.mobileprovision\"",
        "PROFILE_PLIST=\"$SIGNING_DIR/profile.plist\"",
        "KEYCHAIN_PATH=\"$RUNNER_TEMP/homemade-signing.keychain-db\"",
        "KEYCHAIN_PASSWORD=\"$(openssl rand -base64 32)\"",
        "PROFILES_DIR=\"$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles\"",
        "",
        "umask 077",
        "mkdir -p \"$SIGNING_DIR\" \"$PROFILES_DIR\"",
        "printf '%s' \"$IOS_CERTIFICATE_P12_BASE64\" | base64 -D > \"$CERTIFICATE_PATH\"",
        "printf '%s' \"$IOS_PROVISIONING_PROFILE_BASE64\" | base64 -D > \"$PROFILE_PATH\"",
        "",
        "security create-keychain -p \"$KEYCHAIN_PASSWORD\" \"$KEYCHAIN_PATH\"",
        "security set-keychain-settings -lut 21600 \"$KEYCHAIN_PATH\"",
        "security unlock-keychain -p \"$KEYCHAIN_PASSWORD\" \"$KEYCHAIN_PATH\"",
        "security import \"$CERTIFICATE_PATH\" -k \"$KEYCHAIN_PATH\" -P \"$IOS_CERTIFICATE_PASSWORD\" -T /usr/bin/codesign -T /usr/bin/security",
        "security set-key-partition-list -S apple-tool:,apple: -s -k \"$KEYCHAIN_PASSWORD\" \"$KEYCHAIN_PATH\"",
        "security list-keychains -d user -s \"$KEYCHAIN_PATH\"",
        "security default-keychain -d user -s \"$KEYCHAIN_PATH\"",
        "",
        "IDENTITIES=\"$(security find-identity -v -p codesigning \"$KEYCHAIN_PATH\")\"",
        "if ! printf '%s\\n' \"$IDENTITIES\" | grep -Eq '^[[:space:]]*[0-9]+\\)'; then",
        "  echo \"::error::The imported certificate does not contain a valid code-signing identity.\"",
        "  exit 1",
        "fi",
        "",
        "security cms -D -i \"$PROFILE_PATH\" > \"$PROFILE_PLIST\"",
        "PROFILE_UUID=\"$(/usr/libexec/PlistBuddy -c 'Print :UUID' \"$PROFILE_PLIST\")\"",
        "PROFILE_TEAM_ID=\"$(/usr/libexec/PlistBuddy -c 'Print :TeamIdentifier:0' \"$PROFILE_PLIST\")\"",
        "PROFILE_APPLICATION_ID=\"$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:application-identifier' \"$PROFILE_PLIST\")\"",
        "",
        "if [[ \"$PROFILE_TEAM_ID\" != \"$EXPECTED_TEAM_ID\" ]]; then",
        "  echo \"::error::Configured Team ID does not match the provisioning profile.\"",
        "  exit 1",
        "fi",
        "",
        "PROFILE_TEAM_PREFIX=\"$PROFILE_TEAM_ID.\"",
        "PROFILE_BUNDLE_ID=\"${PROFILE_APPLICATION_ID#\"$PROFILE_TEAM_PREFIX\"}\"",
        "if [[ \"$PROFILE_BUNDLE_ID\" == *'*' ]]; then",
        "  PROFILE_BUNDLE_PREFIX=\"${PROFILE_BUNDLE_ID%?}\"",
        "  if [[ \"$EXPECTED_BUNDLE_ID\" != \"$PROFILE_BUNDLE_PREFIX\"* ]]; then",
        "    echo \"::error::Configured Bundle ID does not match the provisioning profile.\"",
        "    exit 1",
        "  fi",
        "elif [[ \"$PROFILE_BUNDLE_ID\" != \"$EXPECTED_BUNDLE_ID\" ]]; then",
        "  echo \"::error::Configured Bundle ID does not match the provisioning profile.\"",
        "  exit 1",
        "fi",
        "",
        "if [[ ! \"$PROFILE_UUID\" =~ ^[A-Fa-f0-9-]{36}$ ]]; then",
        "  echo \"::error::The provisioning profile has an invalid UUID.\"",
        "  exit 1",
        "fi",
        "cp \"$PROFILE_PATH\" \"$PROFILES_DIR/$PROFILE_UUID.mobileprovision\"",
      ].join("\n"),
    },
    {
      name: "Build signed IPA",
      run: createIosBuildCommand(
        signedIpa.exportMethod,
      ),
    },
    {
      name: "Verify signed IPA output",
      run: [
        "set -euo pipefail",
        "IPA_PATH=\"$(find build/ios/ipa -maxdepth 1 -type f -name '*.ipa' -print -quit)\"",
        "if [[ -z \"$IPA_PATH\" ]]; then",
        "  echo \"::error::Flutter did not produce a signed IPA.\"",
        "  exit 1",
        "fi",
        "unzip -t \"$IPA_PATH\" > /dev/null",
        "VERIFY_DIR=\"$RUNNER_TEMP/homemade-ios-verify\"",
        "mkdir -p \"$VERIFY_DIR\"",
        "unzip -q \"$IPA_PATH\" -d \"$VERIFY_DIR\"",
        "APP_PATH=\"$(find \"$VERIFY_DIR/Payload\" -maxdepth 1 -type d -name '*.app' -print -quit)\"",
        "if [[ -z \"$APP_PATH\" ]]; then",
        "  echo \"::error::The IPA does not contain a signed application bundle.\"",
        "  exit 1",
        "fi",
        "codesign --verify --deep --strict \"$APP_PATH\"",
      ].join("\n"),
    },
    {
      name: "Upload signed IPA",
      uses: "actions/upload-artifact@v4",
      with: {
        name: "ios-ipa-signed",
        path: "build/ios/ipa/*.ipa",
      },
    },
    {
      name: "Clean up iOS signing material",
      if: ALWAYS_CONDITION,
      run: [
        "security default-keychain -d user -s login.keychain-db 2>/dev/null || true",
        "security list-keychains -d user -s login.keychain-db 2>/dev/null || true",
        "security delete-keychain \"$RUNNER_TEMP/homemade-signing.keychain-db\" 2>/dev/null || true",
        "PROFILE_PLIST=\"$RUNNER_TEMP/homemade-ios-signing/profile.plist\"",
        "if [[ -f \"$PROFILE_PLIST\" ]]; then",
        "  PROFILE_UUID=\"$(/usr/libexec/PlistBuddy -c 'Print :UUID' \"$PROFILE_PLIST\" 2>/dev/null || true)\"",
        "  if [[ \"$PROFILE_UUID\" =~ ^[A-Fa-f0-9-]{36}$ ]]; then",
        "    rm -f \"$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles/$PROFILE_UUID.mobileprovision\"",
        "  fi",
        "fi",
        "rm -f \"$RUNNER_TEMP/homemade-ios-signing/distribution.p12\"",
        "rm -f \"$RUNNER_TEMP/homemade-ios-signing/profile.mobileprovision\"",
        "rm -f \"$RUNNER_TEMP/homemade-ios-signing/profile.plist\"",
        "rmdir \"$RUNNER_TEMP/homemade-ios-signing\" 2>/dev/null || true",
        "if [[ -d \"$RUNNER_TEMP/homemade-ios-verify\" ]]; then",
        "  find \"$RUNNER_TEMP/homemade-ios-verify\" -depth -delete",
        "fi",
      ].join("\n"),
    },
  ];
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
    if (config.android.signing?.enabled) {
      jobs.android_signed = {
        name: "Signed Android build",
        "runs-on": "ubuntu-latest",
        if: SIGNING_JOB_CONDITION,
        ...qualityDependency(qualityEnabled),
        steps: createAndroidSigningSteps(config),
      };
    } else {
      const androidSteps =
        createFlutterSetupSteps(true);

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
  }

  if (config.ios.enabled) {
    if (config.ios.signedIpa?.enabled) {
      jobs.ios_signed = {
        name: "Signed iOS IPA build",
        "runs-on": "macos-latest",
        if: SIGNING_JOB_CONDITION,
        ...qualityDependency(qualityEnabled),
        steps: createIosSigningSteps(config),
      };
    } else if (config.ios.unsignedBuild) {
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

  const signingMarker =
    createFlutterSigningMarker(config);

  return formatManagedWorkflow(
    "flutter",
    workflow,
    config.branch,
    signingMarker ? [signingMarker] : [],
  );
}
