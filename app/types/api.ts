/**
 * Mirrors backend/app/schemas/*.py exactly. Keep these in sync by hand --
 * there are only a handful of shapes and no shared schema-generation step
 * (out of scope for this phase).
 */

export type ClassName = "Outsider" | "Commoner" | "Citizen" | "Noble" | "Elite";

// --- /me ---------------------------------------------------------------

export interface ProfileOut {
  id: string;
  display_name: string | null;
  weekly_session_target: number;
}

export interface ProfileUpdate {
  display_name?: string | null;
  weekly_session_target?: number;
}

// --- /me/lyfta -----------------------------------------------------------

export interface LyftaStatusOut {
  connected: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
}

export interface ConnectLyftaRequest {
  api_key: string;
}

export interface SyncResult {
  synced_count: number;
  status: string;
}

// --- /me/score, /me/workouts ---------------------------------------------

export interface DailyScoreOut {
  date: string;
  workout_points: number;
  habit_points: number;
  rolling_score: number;
  class_name: ClassName;
}

export interface ScoreSummary {
  today: DailyScoreOut;
  points_to_next_class: number | null;
  history: DailyScoreOut[];
}

export interface SessionBreakdown {
  workout_id: string;
  title: string | null;
  body_weight: number;
  scored_sets: number;
  set_loads: number[];
  raw_session_points: number;
  same_day_factor: number;
  session_points: number;
  bonus_points: number;
}

export interface DailyWorkoutsOut {
  date: string;
  sessions: SessionBreakdown[];
}

// --- /habits ---------------------------------------------------------------

export interface HabitOut {
  id: string;
  name: string;
  active: boolean;
}

export interface HabitWithCompletionOut extends HabitOut {
  completed_on_date: boolean;
}

export interface HabitCreate {
  name: string;
}

export interface HabitUpdate {
  name?: string;
  active?: boolean;
}

export interface HabitLogRequest {
  completed_on: string;
}

// --- /clans ----------------------------------------------------------------

export interface ClanMemberOut {
  display_name: string | null;
  rolling_score: number;
  class_name: ClassName;
}

export interface ClanOut {
  id: string;
  name: string;
  invite_code: string;
  clan_score: number;
  participation: number;
  is_owner: boolean;
  members: ClanMemberOut[];
}

export interface ClanCreate {
  name: string;
}

export interface JoinClanRequest {
  invite_code: string;
}
