import sodium from "libsodium-wrappers";

export async function encryptRepositorySecret(
  publicKeyBase64: string,
  plaintext: string,
): Promise<string> {
  await sodium.ready;

  const publicKey = sodium.from_base64(
    publicKeyBase64,
    sodium.base64_variants.ORIGINAL,
  );
  const secret = sodium.from_string(plaintext);

  try {
    const encrypted = sodium.crypto_box_seal(
      secret,
      publicKey,
    );

    return sodium.to_base64(
      encrypted,
      sodium.base64_variants.ORIGINAL,
    );
  } finally {
    sodium.memzero(secret);
  }
}
