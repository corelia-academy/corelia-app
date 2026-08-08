import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateProfileAdmin } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

type SupabaseFromReturn = ReturnType<typeof supabase.from>;

describe("updateProfileAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully update profile role when database returns updated row", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [{ id: "user-123", role: "instructor" }],
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as unknown as SupabaseFromReturn);

    await expect(
      updateProfileAdmin("user-123", { role: "instructor" })
    ).resolves.not.toThrow();

    expect(supabase.from).toHaveBeenCalledWith("profiles");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ role: "instructor" })
    );
    expect(mockEq).toHaveBeenCalledWith("id", "user-123");
    expect(mockSelect).toHaveBeenCalledWith("id, role");
  });

  it("should throw error if RLS blocks update and database returns empty array", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as unknown as SupabaseFromReturn);

    await expect(
      updateProfileAdmin("user-123", { role: "instructor" })
    ).rejects.toThrow("Cập nhật thất bại: Không tìm thấy tài khoản hoặc không đủ quyền RLS.");
  });

  it("should throw error if DB trigger reverts role back to old value (privilege guard)", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [{ id: "user-123", role: "student" }],
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as unknown as SupabaseFromReturn);

    await expect(
      updateProfileAdmin("user-123", { role: "instructor" })
    ).rejects.toThrow("Cập nhật vai trò bị từ chối bởi cơ sở dữ liệu (Privilege Guard).");
  });

  it("should throw database error if query fails", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Database connection failure" },
    });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as unknown as SupabaseFromReturn);

    await expect(
      updateProfileAdmin("user-123", { role: "admin" })
    ).rejects.toThrow("Database connection failure");
  });
});
