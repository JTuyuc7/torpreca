import { describe, expect, test } from "bun:test";
import { CreateUserSchema } from "./user.schema";

describe("CreateUserSchema", () => {
  test("accepts a valid driver payload", () => {
    const result = CreateUserSchema.safeParse({
      authUserId: "550e8400-e29b-41d4-a716-446655440000",
      name: "Juan Perez",
      role: "driver",
    });

    expect(result.success).toBe(true);
  });

  test("rejects an invalid role", () => {
    const result = CreateUserSchema.safeParse({
      authUserId: "550e8400-e29b-41d4-a716-446655440000",
      name: "Juan Perez",
      role: "not_a_role",
    });

    expect(result.success).toBe(false);
  });

  test("rejects an empty name", () => {
    const result = CreateUserSchema.safeParse({
      authUserId: "550e8400-e29b-41d4-a716-446655440000",
      name: "",
      role: "driver",
    });

    expect(result.success).toBe(false);
  });
});
