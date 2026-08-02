import { afterEach, describe, expect, it, vi } from "vitest";
import { newIdempotencyKey } from "./idempotency";

describe("newIdempotencyKey", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a UUID v4 when crypto.randomUUID is unavailable", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(0);
      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    expect(newIdempotencyKey()).toBe("00000000-0000-4000-8000-000000000000");
    expect(getRandomValues).toHaveBeenCalledOnce();
    expect(globalThis.crypto.randomUUID).toBeUndefined();
  });
});
