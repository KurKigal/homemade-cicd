const SENSITIVE_SIGNING_FIELDS = [
  "keystoreBase64",
  "storePassword",
  "keyPassword",
  "keyAlias",
  "certificateP12Base64",
  "certificatePassword",
  "provisioningProfileBase64",
] as const;

export const API_LOGGER_OPTIONS = {
  redact: {
    paths: SENSITIVE_SIGNING_FIELDS.flatMap(
      (field) => [
        `req.body.${field}`,
        `body.${field}`,
      ],
    ),
    censor: "[REDACTED]",
  },
} as const;
