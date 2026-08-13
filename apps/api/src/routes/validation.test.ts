import Fastify from "fastify";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  parseRouteInput,
  runParamsSchema,
} from "./validation.js";

describe("parseRouteInput", () => {
  it("completes an invalid async route without sending twice", async () => {
    const app = Fastify();
    let onSendCalls = 0;

    app.addHook(
      "onSend",
      async (_request, _reply, payload) => {
        onSendCalls += 1;

        await new Promise<void>((resolve) => {
          setTimeout(resolve, 5);
        });

        return payload;
      },
    );

    app.get(
      "/repos/:owner/:repo/runs/:runId",
      async (request, reply) => {
        const params = parseRouteInput(
          runParamsSchema,
          request.params,
          reply,
          "Invalid workflow run.",
        );

        if (!params) {
          return reply;
        }

        return params;
      },
    );

    try {
      const response = await app.inject({
        method: "GET",
        url: "/repos/example/project/runs/invalid",
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: "Invalid workflow run.",
      });
      expect(onSendCalls).toBe(1);
    } finally {
      await app.close();
    }
  });
});
