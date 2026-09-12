import { describe, expect, it } from "vitest";
import { canManageCourse } from "./authz";
import type { SupabaseClient } from "./supabase";
function client(role: string, data: Record<string, unknown> = {}, owner = "owner") {
  return { from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ error: null, data: table === "profiles" ? { role } : { instructor_id: owner, data } }) }) }) }) } as unknown as SupabaseClient;
}
describe("course completion feature authorization", () => {
  it.each(["admin", "support_staff"])("keeps %s access", async role => {
    expect(await canManageCourse(client(role), "operator", "course", ["students", "submissions"])).toBe(true);
  });
  it("keeps instructor owner access", async () => {
    expect(await canManageCourse(client("instructor"), "owner", "course", ["students"])).toBe(true);
  });
  it.each([{content:true},{students:false},{submissions:"true"},{},null])("rejects a co-instructor without the required feature: %j", permissions => {
    return expect(canManageCourse(client("instructor",{co_instructor_permissions:{operator:permissions}}),"operator","course",["students","submissions"])).resolves.toBe(false);
  });
  it.each(["students","submissions"])("allows explicit %s permission", async feature => {
    expect(await canManageCourse(client("instructor",{co_instructor_permissions:{operator:{[feature]:true}}}),"operator","course",["students","submissions"])).toBe(true);
  });
  it("does not grant access from attribution or change unscoped legacy callers", async () => {
    expect(await canManageCourse(client("instructor",{instructors:[{profile_id:"operator"}]}),"operator","course",["students"])).toBe(false);
    expect(await canManageCourse(client("instructor",{co_instructor_permissions:{operator:{content:true}}}),"operator","course")).toBe(true);
  });
});
