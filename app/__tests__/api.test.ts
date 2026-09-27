/**
 * Mocks lib/supabase entirely (real env vars for it aren't set except via
 * jest.setup.ts's placeholders) and globalThis.fetch, to test api.ts's own
 * request/error/retry logic in isolation.
 */

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      refreshSession: jest.fn(),
    },
  },
}));

import { supabase } from "@/lib/supabase";
import { api, ApiError, UnauthorizedError } from "@/lib/api";

const mockedGetSession = supabase.auth.getSession as jest.Mock;
const mockedRefreshSession = supabase.auth.refreshSession as jest.Mock;

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    statusText: "",
  } as Response;
}

function noBodyResponse(status: number): Response {
  return { status, ok: status >= 200 && status < 300, statusText: "" } as Response;
}

beforeEach(() => {
  jest.resetAllMocks();
  mockedGetSession.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
  globalThis.fetch = jest.fn();
});

describe("api request plumbing", () => {
  it("sends the access token as a Bearer header", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(jsonResponse(200, { id: "u1" }));

    await api.getMe();

    const [, init] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer token-123");
  });

  it("returns undefined for a 204 No Content response", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(noBodyResponse(204));

    const result = await api.disconnectLyfta();

    expect(result).toBeUndefined();
  });

  it("throws ApiError with the parsed detail message on a non-401 error", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(jsonResponse(400, { detail: "bad request" }));

    await expect(api.getMe()).rejects.toMatchObject(new ApiError(400, "bad request"));
  });

  it("omits query params that are undefined", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(jsonResponse(200, []));

    await api.getHabits(undefined);

    const [url] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(url).not.toContain("for_date");
  });

  it("includes provided query params", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(jsonResponse(200, []));

    await api.getHabits("2026-01-01");

    const [url] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("for_date=2026-01-01");
  });
});

describe("401 handling", () => {
  it("refreshes the session and retries once on a 401", async () => {
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(noBodyResponse(401))
      .mockResolvedValueOnce(jsonResponse(200, { id: "u1", display_name: null, weekly_session_target: 3 }));
    mockedRefreshSession.mockResolvedValue({ data: { session: { access_token: "new-token" } }, error: null });

    const result = await api.getMe();

    expect(mockedRefreshSession).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(result.id).toBe("u1");
  });

  it("throws UnauthorizedError if the refresh itself fails", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(noBodyResponse(401));
    mockedRefreshSession.mockResolvedValue({ data: { session: null }, error: new Error("refresh failed") });

    await expect(api.getMe()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1); // no retry once refresh itself fails
  });

  it("does not loop forever if the retried request is still 401", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(noBodyResponse(401)); // every call returns 401
    mockedRefreshSession.mockResolvedValue({ data: { session: { access_token: "new-token" } }, error: null });

    await expect(api.getMe()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2); // original + exactly one retry
  });
});
