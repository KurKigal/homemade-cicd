import sodium from "libsodium-wrappers";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  encryptRepositorySecret,
} from "./secret-encryption.js";

describe("encryptRepositorySecret", () => {
  it("seals plaintext for the repository public key", async () => {
    await sodium.ready;

    const keyPair = sodium.crypto_box_keypair();
    const publicKey = sodium.to_base64(
      keyPair.publicKey,
      sodium.base64_variants.ORIGINAL,
    );
    const plaintext = "synthetic-signing-value";

    const encrypted = await encryptRepositorySecret(
      publicKey,
      plaintext,
    );

    expect(encrypted).not.toContain(plaintext);

    const decrypted = sodium.crypto_box_seal_open(
      sodium.from_base64(
        encrypted,
        sodium.base64_variants.ORIGINAL,
      ),
      keyPair.publicKey,
      keyPair.privateKey,
    );

    expect(sodium.to_string(decrypted)).toBe(plaintext);
  });
});
