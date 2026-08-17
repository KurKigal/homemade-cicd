import { GITHUB_ACTIONS_SECRET_MAX_BYTES } from "@homemade-cicd/core";

const textEncoder = new TextEncoder();

export function validateSecretValue(value: string, label: string): void {
  if (value.length === 0) {
    throw new Error(`${label} is required.`);
  }

  if (textEncoder.encode(value).byteLength > GITHUB_ACTIONS_SECRET_MAX_BYTES) {
    throw new Error(
      `${label} exceeds GitHub Actions' 48 KB secret value limit.`,
    );
  }
}

export async function credentialFileToBase64(
  file: File,
  allowedExtensions: readonly string[],
  label: string,
): Promise<string> {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

  if (!allowedExtensions.includes(extension)) {
    throw new Error(
      `${label} must use one of these file extensions: ${allowedExtensions.join(", ")}.`,
    );
  }

  if (file.size === 0) {
    throw new Error(`${label} cannot be empty.`);
  }

  const encodedLength = 4 * Math.ceil(file.size / 3);

  if (encodedLength > GITHUB_ACTIONS_SECRET_MAX_BYTES) {
    throw new Error(
      `${label} exceeds GitHub Actions' 48 KB limit after base64 encoding.`,
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    let binary = "";
    const chunkSize = 0x8000;

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(
        ...bytes.subarray(offset, offset + chunkSize),
      );
    }

    const base64 = btoa(binary);
    validateSecretValue(base64, label);
    return base64;
  } finally {
    bytes.fill(0);
  }
}
