import Fastify from "fastify";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  API_LOGGER_OPTIONS,
} from "./logger.js";

describe("API logger redaction", () => {
  it("redacts every signing credential field from structured logs", async () => {
    const output: string[] = [];
    const app = Fastify({
      logger: {
        ...API_LOGGER_OPTIONS,
        stream: {
          write(message: string) {
            output.push(message);
          },
        },
      },
    });
    const payload = {
      keystoreBase64: "plain-keystore",
      storePassword: "plain-store-password",
      keyPassword: "plain-key-password",
      keyAlias: "plain-key-alias",
      certificateP12Base64: "plain-certificate",
      certificatePassword: "plain-certificate-password",
      provisioningProfileBase64: "plain-profile",
    };

    app.post("/redaction-probe", async (request) => {
      request.log.info(
        { body: request.body },
        "credential redaction probe",
      );
      return { ok: true };
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/redaction-probe",
        payload,
      });

      expect(response.statusCode).toBe(200);
      const logs = output.join("\n");

      for (const value of Object.values(payload)) {
        expect(logs).not.toContain(value);
      }

      expect(logs).toContain("[REDACTED]");
    } finally {
      await app.close();
    }
  });
});
