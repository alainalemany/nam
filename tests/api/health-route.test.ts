import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { GET } from "@/app/api/health/route";
import { prisma } from "@/lib/prisma";

const queryRaw = vi.mocked(prisma.$queryRaw);

describe("GET /api/health", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("returns ok when the database check succeeds", async () => {
    queryRaw.mockResolvedValueOnce([{ ok: 1 }]);

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      status: "ok",
      database: "ok",
    });
    expect(response.status).toBe(200);
  });

  it("returns 503 when the database check fails", async () => {
    queryRaw.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      status: "error",
      database: "unavailable",
    });
    expect(response.status).toBe(503);
  });
});
