// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./api";
import type { Node } from "./types";

const maintenanceNode = {
  id: "22222222-2222-4222-8222-222222222222",
  recordVersion: 5,
} as Node;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("maintenance API contract", () => {
  it("posts the canonical node identity and optimistic version for return", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          nodeId: maintenanceNode.id,
          succeeded: true,
          checks: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetch);

    await api.returnToService(maintenanceNode);

    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/nodes/${maintenanceNode.id}/return-to-service`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ recordVersion: 5 }),
        credentials: "same-origin",
      }),
    );
  });

  it("preserves safe structured return-to-service failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "VERIFICATION_FAILED",
              message:
                "node remains in maintenance because required return-to-service checks failed: api, dns",
              requestId: "request-maintenance-return",
            },
          }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const error = await api
      .returnToService(maintenanceNode)
      .catch((caught) => (caught instanceof ApiError ? caught : undefined));

    expect(error).toMatchObject({
      code: "VERIFICATION_FAILED",
      status: 502,
      requestId: "request-maintenance-return",
      message:
        "node remains in maintenance because required return-to-service checks failed: api, dns",
    });
  });
});
