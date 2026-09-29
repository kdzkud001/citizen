import type {
  ClanCreate,
  ClanOut,
  ConnectLyftaRequest,
  DailyWorkoutsOut,
  HabitCreate,
  HabitLogRequest,
  HabitOut,
  HabitUpdate,
  HabitWithCompletionOut,
  JoinClanRequest,
  LyftaStatusOut,
  ProfileOut,
  ProfileUpdate,
  ScoreSummary,
  SyncResult,
  WheelOut,
} from "../types/api";
import { supabase } from "./supabase";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("Missing EXPO_PUBLIC_API_BASE_URL -- copy .env.example to .env and fill it in.");
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Thrown specifically on a 401 that survives a session-refresh retry --
 * callers (see hooks/useAuth.tsx) treat this as "the session is truly
 * dead," signing the user out rather than showing a generic error. */
export class UnauthorizedError extends ApiError {
  constructor(message: string) {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
    return JSON.stringify(body?.detail ?? body);
  } catch {
    return response.statusText;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path, API_BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && !isRetry) {
    // getSession() should already return a fresh token, but a 401 can still
    // happen (e.g. the refresh token itself was revoked). Force one refresh
    // attempt before giving up.
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) {
      return request<T>(path, options, true);
    }
    throw new UnauthorizedError(await parseErrorDetail(response));
  }

  if (!response.ok) {
    if (response.status === 401) throw new UnauthorizedError(await parseErrorDetail(response));
    throw new ApiError(response.status, await parseErrorDetail(response));
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  getMe: () => request<ProfileOut>("/me"),
  updateMe: (body: ProfileUpdate) => request<ProfileOut>("/me", { method: "PATCH", body }),

  getLyftaStatus: () => request<LyftaStatusOut>("/me/lyfta"),
  connectLyfta: (body: ConnectLyftaRequest) => request<void>("/me/lyfta", { method: "POST", body }),
  disconnectLyfta: () => request<void>("/me/lyfta", { method: "DELETE" }),
  syncLyfta: () => request<SyncResult>("/me/lyfta/sync", { method: "POST" }),

  getScore: () => request<ScoreSummary>("/me/score"),
  getWorkouts: (days?: number) => request<DailyWorkoutsOut[]>("/me/workouts", { query: { days } }),
  getWheel: (days?: number) => request<WheelOut>("/me/wheel", { query: { days } }),

  getHabits: (forDate?: string) =>
    request<HabitWithCompletionOut[]>("/habits", { query: { for_date: forDate } }),
  createHabit: (body: HabitCreate) => request<HabitOut>("/habits", { method: "POST", body }),
  updateHabit: (id: string, body: HabitUpdate) =>
    request<HabitOut>(`/habits/${id}`, { method: "PATCH", body }),
  logHabitCompletion: (habitId: string, body: HabitLogRequest) =>
    request<void>(`/habits/${habitId}/completions`, { method: "POST", body }),
  deleteHabitCompletion: (habitId: string, completedOn: string) =>
    request<void>(`/habits/${habitId}/completions/${completedOn}`, { method: "DELETE" }),

  createClan: (body: ClanCreate) => request<ClanOut>("/clans", { method: "POST", body }),
  joinClan: (body: JoinClanRequest) => request<ClanOut>("/clans/join", { method: "POST", body }),
  leaveClan: () => request<void>("/clans/leave", { method: "POST" }),
  regenerateClanCode: () => request<ClanOut>("/clans/regenerate-code", { method: "POST" }),
  getMyClan: () => request<ClanOut>("/clans/me"),
};
