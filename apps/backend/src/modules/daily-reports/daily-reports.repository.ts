import type { DailyReport } from "@torpreca/shared";
import { supabaseAdmin } from "../../core/db/supabase";

function toDailyReport(row: Record<string, unknown>): DailyReport {
  return {
    id: row.id as string,
    driverId: row.driver_id as string,
    date: row.date as string,
    drivenKm: row.driven_km as number,
    completedStops: row.completed_stops as number,
    routesServed: row.routes_served as number,
    timeOnRoute: row.time_on_route as string | null,
    generatedAt: row.generated_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface UpsertDailyReportInput {
  driverId: string;
  date: string;
  drivenKm: number;
  completedStops: number;
  routesServed: number;
  timeOnRoute: string | null;
}

export interface DailyReportsRepository {
  getByDriverAndDate(driverId: string, date: string): Promise<DailyReport | null>;
  // Regenerating the same driver+date replaces the existing row (matches the
  // `daily_reports_driver_id_date_key` UNIQUE constraint) — a driver only
  // ever has one report per day, recomputed from scratch each time a route
  // of theirs finishes that day.
  upsert(input: UpsertDailyReportInput): Promise<DailyReport>;
}

export const dailyReportsRepository: DailyReportsRepository = {
  async getByDriverAndDate(driverId, date) {
    const { data, error } = await supabaseAdmin
      .from("daily_reports")
      .select("*")
      .eq("driver_id", driverId)
      .eq("date", date)
      .maybeSingle();
    if (error) throw error;
    return data ? toDailyReport(data) : null;
  },

  async upsert(input) {
    const { data: existing, error: findError } = await supabaseAdmin
      .from("daily_reports")
      .select("*")
      .eq("driver_id", input.driverId)
      .eq("date", input.date)
      .maybeSingle();
    if (findError) throw findError;

    const row = {
      driver_id: input.driverId,
      date: input.date,
      driven_km: input.drivenKm,
      completed_stops: input.completedStops,
      routes_served: input.routesServed,
      time_on_route: input.timeOnRoute,
      generated_at: new Date().toISOString(),
    };

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from("daily_reports")
        .update(row)
        .eq("id", existing.id as string)
        .select("*")
        .single();
      if (error) throw error;
      return toDailyReport(data);
    }

    const { data, error } = await supabaseAdmin
      .from("daily_reports")
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;
    return toDailyReport(data);
  },
};
