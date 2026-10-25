import type { RoutesReport } from "@torpreca/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadRoutesCsv, getRoutesReport } from "./reports-client";

const fetchMock = vi.fn();
const range = { from: "2026-01-01", to: "2026-01-31" };

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getRoutesReport", () => {
  it("sends the range in the query string and returns the report", async () => {
    const report = { from: range.from, to: range.to } as RoutesReport;
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(report), { status: 200 }));

    const result = await getRoutesReport(range);

    expect(fetchMock).toHaveBeenCalledWith("/api/reports/routes?from=2026-01-01&to=2026-01-31");
    expect(result).toEqual({ ok: true, report });
  });

  it("reports the status of a failed response, and 0 when the request itself fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
    expect(await getRoutesReport(range)).toEqual({ ok: false, status: 403 });

    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await getRoutesReport(range)).toEqual({ ok: false, status: 0 });
  });
});

describe("downloadRoutesCsv", () => {
  it("saves the response as a named file", async () => {
    fetchMock.mockResolvedValueOnce(new Response("code\r\nR-00001\r\n", { status: 200 }));
    const createObjectURL = vi.fn(() => "blob:csv");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe("routes-2026-01-01_2026-01-31.csv");
      expect(this.href).toBe("blob:csv");
    });

    const result = await downloadRoutesCsv(range);

    expect(fetchMock).toHaveBeenCalledWith("/api/reports/routes/csv?from=2026-01-01&to=2026-01-31");
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:csv");
    expect(result).toEqual({ ok: true });
    click.mockRestore();
  });

  it("downloads nothing when the server refuses", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    expect(await downloadRoutesCsv(range)).toEqual({ ok: false, status: 500 });
    expect(click).not.toHaveBeenCalled();
    click.mockRestore();
  });
});
