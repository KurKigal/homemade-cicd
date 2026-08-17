import type { FlutterPipelineConfig } from "@homemade-cicd/core";

export type SignedIpaConfig = NonNullable<
  FlutterPipelineConfig["ios"]["signedIpa"]
>;

export const DISABLED_ANDROID_SIGNING = { enabled: false } as const;

export const DISABLED_SIGNED_IPA: SignedIpaConfig = {
  enabled: false,
  teamId: "",
  bundleId: "",
  exportMethod: "app-store",
};

export function normalizeFlutterSigningConfig(
  config: FlutterPipelineConfig,
): FlutterPipelineConfig {
  return {
    ...config,
    android: {
      ...config.android,
      signing: config.android.signing ?? DISABLED_ANDROID_SIGNING,
    },
    ios: {
      ...config.ios,
      signedIpa: config.ios.signedIpa ?? DISABLED_SIGNED_IPA,
    },
  };
}
