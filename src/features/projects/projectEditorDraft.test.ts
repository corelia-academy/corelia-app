import { describe, expect, it } from "vitest";
import type { Project } from "@/types/projects";
import { changePrimaryLocale, contentForLocale, projectDraft, projectLocalePayload } from "./projectEditorDraft";

describe("localized project draft", () => {
  it("defaults new projects to the UI language and legacy projects to Vietnamese", () => {
    expect(projectDraft(null,"en-US").primaryLocale).toBe("en");
    expect(projectDraft({title:"Old title"} as Project,"en").primaryLocale).toBe("vi");
  });
  it("keeps saved source language and removes database locale metadata before draft recovery", () => {
    const draft = projectDraft({title:"Base",i18n:{primary_content_locale:"en"},content_locales:{en:{title:"English",description:"Story",updated_at:"old"},vi:{title:"Tên"}}} as unknown as Project,"vi");
    expect(draft.primaryLocale).toBe("en"); expect(draft.title).toBe("English");
    expect(Object.keys(draft.locales.en!)).toEqual(["title","summary","description","progress"]);
  });
  it("round-trips primary changes without overwriting content or shared fields", () => {
    const original = {...projectDraft(),title:"Tên",summary:"Tóm tắt",slug:"stable-slug",locales:{en:{title:"Title",summary:"Summary"}}};
    const english = changePrimaryLocale(original,"en");
    expect(english.title).toBe("Title"); expect(english.slug).toBe("stable-slug");
    expect(contentForLocale(english,"vi").title).toBe("Tên");
    expect(changePrimaryLocale(english,"vi").summary).toBe("Tóm tắt");
    expect(projectLocalePayload(english).locales.en?.title).toBe("Title");
  });
});
