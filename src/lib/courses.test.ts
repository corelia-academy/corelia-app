import { describe, expect, it, vi } from "vitest";
import type { CourseLesson } from "@/types/courses";

vi.mock("@/lib/coreliaEdgeApi", () => ({
  coreliaEdgeUrl: (name: string) => name,
  supabaseFunctionHeaders: () => ({}),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { saveCourseWithLocale, updateCourse, updateSection, addLesson, updateLesson, applyCourseLessonLocaleContent, deleteCourse, deleteLesson, getLearnerCourseProgressSnapshot } from "./courses";
import { supabase } from "./supabase";

const masterVideoLesson: CourseLesson = {
  id: "lesson-1",
  section_id: "section-1",
  title: "Master video lesson",
  lesson_format: "video",
  youtube_url: "https://youtu.be/eFYRrBsumi0",
  youtube_start_seconds: 15,
  youtube_end_seconds: 45,
  duration_seconds: 30,
  order: 0,
};

it("loads requested curriculum even before a learner has progress", async () => {
  const inCourses = vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [{ id: "first", course_id: "new", section_id: "section", sort_order: 0, published: true, archived_at: null, data: { title: "First" } }], error: null }) });
  vi.mocked(supabase.from).mockImplementation((table: string) => (table === "lesson_progress"
    ? { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) }
    : { select: () => ({ in: inCourses }) }) as never);
  const snapshot = await getLearnerCourseProgressSnapshot("learner", ["new", "new"]);
  expect(snapshot.courseIds).toEqual(["new"]);
  expect(inCourses).toHaveBeenCalledWith("course_id", ["new"]);
  expect(snapshot.lessonsByCourse.get("new")).toEqual([expect.objectContaining({ id: "first", published: true })]);
  expect(snapshot.progressByCourse.size).toBe(0);
});

describe("applyCourseLessonLocaleContent", () => {
  it.each([42, {}, [], true])("falls back to master text and video when legacy locale values are %j", invalid => {
    const lesson = { ...masterVideoLesson, short_description: "Summary", description_markdown: "Read" };
    const localized = { locale: "en", title: invalid, short_description: invalid, description_markdown: invalid, youtube_url: invalid } as unknown as Parameters<typeof applyCourseLessonLocaleContent>[1];
    expect(applyCourseLessonLocaleContent(lesson, localized)).toMatchObject(lesson);
    expect(localized).toMatchObject({ title: invalid, youtube_url: invalid });
  });

  it("ignores non-numeric locale segments while using a valid translated video", () => {
    const localized = { locale: "en", youtube_url: "https://youtu.be/dQw4w9WgXcQ", youtube_start_seconds: "10", youtube_end_seconds: {} } as unknown as Parameters<typeof applyCourseLessonLocaleContent>[1];
    expect(applyCourseLessonLocaleContent(masterVideoLesson, localized)).toMatchObject({ youtube_url: "https://youtu.be/dQw4w9WgXcQ", youtube_start_seconds: 15, youtube_end_seconds: 45 });
  });

  it("preserves canonical practice copy when a translation has invalid text types", () => {
    const config = { mode: "guided_project", revision: 1, checklist_items: [{ id: "item", label: "Original label" }], project_steps: [{ id: "step", order: 0, title: "Original step", instructions_markdown: "Original instructions", verification: "self_check" }] };
    const lesson = { ...masterVideoLesson, lesson_format: "practice", practice_config: config } as CourseLesson;
    const localized = { locale: "en", practice_copy: { item: { label: {} }, step: { title: false, instructions_markdown: [] } } } as unknown as Parameters<typeof applyCourseLessonLocaleContent>[1];
    expect(applyCourseLessonLocaleContent(lesson, localized).practice_config).toEqual(config);
    expect(lesson.practice_config).toBe(config);
    expect(applyCourseLessonLocaleContent(lesson, { locale: "en", title: "Translated lesson", practice_copy: { step: { title: "Translated step" } } }).practice_config?.project_steps?.[0].title).toBe("Translated step");
  });

  it("keeps malformed legacy practice data intact while translating the lesson title", () => {
    const config = { mode: "checklist", checklist_items: {} };
    const lesson = { ...masterVideoLesson, lesson_format: "practice", practice_config: config } as unknown as CourseLesson;
    const result = applyCourseLessonLocaleContent(lesson, { locale: "en", title: "Translated", practice_copy: { item: { label: "Translated item" } } });
    expect(result.title).toBe("Translated");
    expect(result.practice_config).toBe(config);
  });

  it("keeps the master video settings when a locale URL is empty", () => {
    const result = applyCourseLessonLocaleContent(masterVideoLesson, {
      locale: "en",
      title: "English title",
      youtube_url: "   ",
      youtube_start_seconds: 1,
      youtube_end_seconds: 2,
    });

    expect(result.title).toBe("English title");
    expect(result.youtube_url).toBe(masterVideoLesson.youtube_url);
    expect(result.youtube_start_seconds).toBe(15);
    expect(result.youtube_end_seconds).toBe(45);
  });

  it("keeps the master video settings when a locale URL is malformed", () => {
    const result = applyCourseLessonLocaleContent(masterVideoLesson, {
      locale: "en",
      title: "English title",
      youtube_url: "not-a-youtube-url",
      youtube_start_seconds: 1,
      youtube_end_seconds: 2,
    });

    expect(result.youtube_url).toBe(masterVideoLesson.youtube_url);
    expect(result.youtube_start_seconds).toBe(15);
    expect(result.youtube_end_seconds).toBe(45);
  });

  it("uses a valid locale video URL and its segment overrides", () => {
    const result = applyCourseLessonLocaleContent(masterVideoLesson, {
      locale: "en",
      title: "English title",
      youtube_url: " https://youtu.be/dQw4w9WgXcQ ",
      youtube_start_seconds: 5,
      youtube_end_seconds: 20,
    });

    expect(result.youtube_url).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(result.youtube_start_seconds).toBe(5);
    expect(result.youtube_end_seconds).toBe(20);
  });
});


describe("confirmed learning deletion", () => {
  it.each([
    ["course", () => deleteCourse("course-1")],
    ["lesson", () => deleteLesson("course-1", "lesson-1")],
  ])("surfaces a missing or unauthorized %s instead of reporting success", async (_kind, remove) => {
    const query = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "No row was deleted", code: "PGRST116" } }),
    };
    vi.mocked(supabase.from).mockReturnValue(query as unknown as ReturnType<typeof supabase.from>);
    await expect(remove()).rejects.toThrow("No row was deleted");
  });

  it("confirms a deleted lesson using its course and lesson IDs", async () => {
    const query = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "lesson-1" }, error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(query as unknown as ReturnType<typeof supabase.from>);
    await expect(deleteLesson("course-1", "lesson-1")).resolves.toBeUndefined();
    expect(query.eq.mock.calls).toEqual([["course_id", "course-1"], ["id", "lesson-1"]]);
  });
});


describe("legacy authoring helpers with publication columns", () => {
  it("creates a draft by default and returns the persisted publication state", async () => {
    const single = vi.fn().mockResolvedValue({data:{id:"saved",section_id:"section",sort_order:2,published:false,archived_at:null,data:{title:"Saved title",duration_seconds:37}},error:null});
    const insert = vi.fn().mockReturnValue({select:()=>({single})});
    vi.mocked(supabase.from).mockReturnValue({insert} as never);
    const result=await addLesson("course",{section_id:"section",title:"Title",order:2,duration_seconds:37});
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({published:false,archived_at:null,data:{title:"Title",duration_seconds:37}}));
    expect(result).toMatchObject({id:"saved",title:"Saved title",published:false,archived_at:null,order:2,duration_seconds:37});
  });
  it("keeps explicit publication out of content JSON when inserting", async () => {
    const insert=vi.fn().mockReturnValue({select:()=>({single:async()=>({data:{id:"saved",section_id:"s",sort_order:0,published:true,data:{title:"Article"}},error:null})})});
    vi.mocked(supabase.from).mockReturnValue({insert} as never);
    await addLesson("course",{section_id:"s",title:"Article",order:0,duration_seconds:37,published:true,archived_at:null});
    expect(insert.mock.calls[0][0]).toMatchObject({published:true,archived_at:null});
    expect(insert.mock.calls[0][0].data).not.toHaveProperty("published");
    expect(insert.mock.calls[0][0].data).not.toHaveProperty("archived_at");
  });
  it("keeps duration and uses columns for status, rejecting zero-row saves", async () => {
    const read={select:vi.fn(),eq:vi.fn(),single:vi.fn().mockResolvedValue({data:{data:{title:"Old",duration_seconds:37,published:true}},error:null})};
    read.select.mockReturnValue(read);read.eq.mockReturnValue(read);
    const write={update:vi.fn(),eq:vi.fn(),select:vi.fn(),single:vi.fn().mockResolvedValue({data:null,error:{message:"No row updated"}})};
    write.update.mockReturnValue(write);write.eq.mockReturnValue(write);write.select.mockReturnValue(write);
    vi.mocked(supabase.from).mockReturnValueOnce(read as never).mockReturnValueOnce(write as never);
    await expect(updateLesson("course","lesson",{title:"Changed",published:false,archived_at:null})).rejects.toThrow("No row updated");
    expect(write.update).toHaveBeenCalledWith({data:{title:"Changed",duration_seconds:37},published:false,archived_at:null});
    expect(write.single).toHaveBeenCalledOnce();
  });
});


it("clears a section description explicitly and rejects saves affecting no rows", async () => {
  const read={select:vi.fn(),eq:vi.fn(),single:vi.fn().mockResolvedValue({data:{sort_order:2,data:{title:"Section",description:"Remove this",metadata:"Keep"}},error:null})};
  read.select.mockReturnValue(read);read.eq.mockReturnValue(read);
  const write={update:vi.fn(),eq:vi.fn(),select:vi.fn(),single:vi.fn().mockResolvedValue({data:null,error:{message:"Section no longer editable"}})};
  write.update.mockReturnValue(write);write.eq.mockReturnValue(write);write.select.mockReturnValue(write);
  vi.mocked(supabase.from).mockReturnValueOnce(read as never).mockReturnValueOnce(write as never);
  await expect(updateSection("course","section",{description:""})).rejects.toThrow("Section no longer editable");
  expect(write.update).toHaveBeenCalledWith({data:{title:"Section",description:"",metadata:"Keep"},sort_order:2});
  expect(write.single).toHaveBeenCalledOnce();
});


it("rejects course saves when RLS no longer allows writing the row", async () => {
  const single = vi.fn().mockResolvedValue({ data: null, error: { message: "No persisted row" } });
  vi.mocked(supabase.from).mockReturnValue({
    select: () => ({ eq: () => ({ single: async () => ({ data: { data: { short_description: "Old" } }, error: null }) }) }),
    update: () => ({ eq: () => ({ select: () => ({ single }) }) }),
  } as never);
  await expect(updateCourse("course", { short_description: "" })).rejects.toThrow("No persisted row");
  expect(single).toHaveBeenCalled();
});

it("persists an explicit empty course field while keeping unrelated metadata", async () => {
  const update = vi.fn().mockReturnValue({ eq: () => ({ select: () => ({ single: async () => ({ data: { id: "course" }, error: null }) }) }) });
  vi.mocked(supabase.from).mockReturnValue({
    select: () => ({ eq: () => ({ single: async () => ({ data: { data: { short_description: "Old", unrelated: "Keep" } }, error: null }) }) }),
    update,
  } as never);
  await updateCourse("course", { short_description: "" });
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { short_description: "", unrelated: "Keep" } }));
});

it("saves metadata and locale in one RPC and propagates rollback failures", async () => {
  vi.mocked(supabase.rpc).mockResolvedValueOnce({ error: null } as never);
  await saveCourseWithLocale("course", { published: false, short_description: "", thumbnail_url: undefined }, "en", { title: "English", short_description: "" });
  expect(supabase.rpc).toHaveBeenLastCalledWith("learning_save_course_info", { p_course: "course", p_patch: { published: false, short_description: "" }, p_locale: "en", p_copy: { title: "English", short_description: "" } });
  vi.mocked(supabase.rpc).mockResolvedValueOnce({ error: { message: "LOCALE_INVALID" } } as never);
  await expect(saveCourseWithLocale("course", { published: false }, "en", { title: "Draft" })).rejects.toThrow("LOCALE_INVALID");
});

 it("saves attribution as metadata without changing co-instructor permissions or creating invites", async () => {
  vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
  const instructors = [{ profile_id: "guest", order: 0, role_label: "Guest" }];
  await saveCourseWithLocale("course", { instructors }, "en", { title: "Course" });
  expect(supabase.rpc).toHaveBeenLastCalledWith("learning_save_course_info", {
    p_course: "course", p_patch: { instructors }, p_locale: "en", p_copy: { title: "Course" },
  });
});
