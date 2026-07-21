// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { getPiAPI } from "./pi-api";

describe("getPiAPI", () => {
  afterEach(() => {
    // @ts-expect-error test cleanup
    delete window.piAPI;
  });

  it("returns undefined when piAPI is not exposed", () => {
    expect(getPiAPI()).toBeUndefined();
  });

  it("returns window.piAPI when present", () => {
    const api = { listSessions: vi.fn() } as never;
    window.piAPI = api;
    expect(getPiAPI()).toBe(api);
  });
});
