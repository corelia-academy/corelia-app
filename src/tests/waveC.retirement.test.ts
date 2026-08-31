import { describe, it, expect, vi } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

vi.mock("@/lib/coreliaEdgeApi", () => ({
  coreliaEdgeUrl: (name: string) => name,
  supabaseFunctionHeaders: () => ({}),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {},
}));

import { type PaymentPurpose } from "@/lib/payments";

function readSource(rootDir: string, relPath: string): string {
  const fullPath = join(rootDir, relPath);
  expect(existsSync(fullPath), `${relPath} must remain present`).toBe(true);
  return readFileSync(fullPath, "utf8");
}

function listRuntimeSourceFiles(srcDir: string): string[] {
  const runtimeExtension = /\.(?:ts|tsx|js|jsx)$/;
  const typeDeclaration = /\.d\.(?:ts|tsx|js|jsx)$/;
  const excludedDirectories = new Set(["assets", "tests"]);
  const files: string[] = [];

  function visit(directory: string): void {
    const entries = readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    for (const entry of entries) {
      const fullPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!excludedDirectories.has(entry.name)) visit(fullPath);
        continue;
      }

      if (entry.isFile() && runtimeExtension.test(entry.name) && !typeDeclaration.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  visit(srcDir);
  return files;
}

describe("Wave C Retirement Contract Tests (Epic #332 / Issues #328 and #331)", () => {
  const RETIRED_LEARNER_AI_EDGE_FUNCTIONS = [
    "ai-tutor",
    "embed-lesson",
    "generate-flashcards",
    "generate-learning-path",
    "generate-lesson-summary",
  ] as const;

  const INSTRUCTOR_AI_EDGE_FUNCTIONS = [
    "generate-description",
    "generate-questions",
  ] as const;

  const rootDir = process.cwd();

  describe("WC-Learner-UI: Retired learner AI entry points stay unreachable", () => {
    it("keeps Learn.tsx free of retired readiness, recap, and flashcard cards", () => {
      const content = readSource(rootDir, "src/pages/learn/Learn.tsx");
      const retiredCards = [
        "LessonReadinessCard",
        "LessonRecapCard",
        "FlashcardDeckCard",
      ];

      for (const component of retiredCards) {
        expect(content).not.toMatch(
          new RegExp(`import\\s+(?:\\{[^}]*\\b${component}\\b[^}]*\\}|${component}\\b)`),
        );
        expect(content).not.toMatch(new RegExp(`<\\s*${component}\\b`));
      }
    });

    it("confirms Cora routes and redirects are completely removed from App.tsx", () => {
      const appSource = readSource(rootDir, "src/App.tsx");
      const coraRoutes = [
        "account/cora",
        'path="cora"',
        "cora/checkout",
        "upgrade/cora",
        "cora-vouchers",
      ];
      for (const r of coraRoutes) {
        expect(appSource).not.toContain(r);
      }
    });

    it("keeps the retired Cora handle fail-closed instead of redirecting to a public profile", () => {
      const handleRedirectSource = readSource(rootDir, "src/pages/users/UserHandleRedirect.tsx");

      expect(handleRedirectSource).toMatch(/RESERVED_HANDLES[\s\S]*["']cora["']/);
      expect(handleRedirectSource).toMatch(
        /RESERVED_HANDLES\.has\(handle\.toLowerCase\(\)\)\) return <NotFound \/>/,
      );
    });

    it("routes retired learning-path URLs to NotFound before the handle wildcard", () => {
      const appSource = readSource(rootDir, "src/App.tsx");
      const retiredRouteIndex = appSource.indexOf('path="learning-path/*"');
      const handleWildcardIndex = appSource.indexOf('path=":handle/*"');

      expect(retiredRouteIndex).toBeGreaterThanOrEqual(0);
      expect(handleWildcardIndex).toBeGreaterThan(retiredRouteIndex);

      const retiredRouteSource = appSource.slice(retiredRouteIndex, handleWildcardIndex);
      expect(retiredRouteSource).toContain("<NotFound />");
      expect(retiredRouteSource).not.toContain("<Navigate");
      expect(retiredRouteSource).not.toContain("UserHandleRedirect");
    });
  });

  describe("WC-01: Learner frontend has zero AI Edge Function invocations", () => {
    it(
      "confirms runtime source in src has no retired learner AI edge function references",
      () => {
        const srcDir = join(rootDir, "src");
        const runtimeSourceFiles = listRuntimeSourceFiles(srcDir);

        expect(runtimeSourceFiles.length).toBeGreaterThan(0);

        for (const fullPath of runtimeSourceFiles) {
          const relPath = relative(rootDir, fullPath);
          const content = readFileSync(fullPath, "utf8");

          for (const fn of RETIRED_LEARNER_AI_EDGE_FUNCTIONS) {
            expect(content, `${relPath} must not reference retired learner endpoint ${fn}`).not.toContain(
              fn,
            );
          }
        }
      },
      15000,
    );
  });

  describe("WC-02 to WC-09: Learner AI Edge Functions are physically absent", () => {
    for (const fn of RETIRED_LEARNER_AI_EDGE_FUNCTIONS) {
      it(`proves ${fn} has no deployable source directory`, () => {
        const fullPath = join(rootDir, "supabase", "functions", fn, "index.ts");
        expect(existsSync(fullPath)).toBe(false);
      });
    }
  });

  describe("WC-Instructor: Instructor-facing AI functions enforce strict auth and role guards", () => {
    for (const fn of INSTRUCTOR_AI_EDGE_FUNCTIONS) {
      it(`proves ${fn} enforces role guard (instructor/support_staff/admin) and course management check`, () => {
        const fullPath = join(rootDir, "supabase", "functions", fn, "index.ts");
        expect(existsSync(fullPath)).toBe(true);
        const content = readFileSync(fullPath, "utf8");

        expect(content).toContain("verifyBearerUser");
        expect(content).toContain("getUserRole");
        expect(content).toContain("instructor");
        expect(content).toContain("support_staff");
        expect(content).toContain("admin");
        expect(content).toContain("ensureCanManageCourse");
      });

      it(`classifies malformed Authorization as 401 in ${fn}`, () => {
        const content = readSource(rootDir, `supabase/functions/${fn}/index.ts`);

        expect(content).toContain(
          'throw new HttpStatusError(401, "Invalid Authorization header")',
        );
        expect(content).toMatch(
          /const status = error instanceof HttpStatusError\s*\? error\.status/,
        );
      });
    }

    it("scopes lesson generation to the requested course when both IDs are provided", () => {
      const content = readFileSync(
        join(rootDir, "supabase", "functions", "generate-description", "index.ts"),
        "utf8",
      );
      expect(content).toMatch(
        /if \(params\.lessonId\)[\s\S]*?\.eq\("id", params\.lessonId\)[\s\S]*?if \(params\.courseId\) query\.eq\("course_id", params\.courseId\)/,
      );
    });

    it("retains instructor AI helpers and their Edge Function endpoints", () => {
      const descriptionHelper = readSource(rootDir, "src/lib/descriptionGenerator.ts");
      const questionHelper = readSource(rootDir, "src/lib/questionGenerator.ts");

      expect(descriptionHelper).toContain("export async function invokeGenerateDescription");
      expect(descriptionHelper).toContain("/functions/v1/generate-description");
      expect(questionHelper).toContain("export async function invokeGenerateQuestions");
      expect(questionHelper).toContain("/functions/v1/generate-questions");
    });

    it("retains instructor dialogs and course editor callers", () => {
      const courseEditor = readSource(
        rootDir,
        "src/pages/instructor-course-edit/InstructorCourseEdit.tsx",
      );
      const descriptionDialog = readSource(
        rootDir,
        "src/pages/instructor-course-edit/components/DescriptionGeneratorDialog.tsx",
      );
      const questionDialog = readSource(
        rootDir,
        "src/pages/instructor-course-edit/components/QuestionGeneratorDialog.tsx",
      );

      expect(courseEditor).toMatch(/invokeGenerateDescription\s*\(/);
      expect(courseEditor).toMatch(/invokeGenerateQuestions\s*\(/);
      expect(descriptionDialog).toMatch(/invokeGenerateDescription\s*\(\s*request\.requestBody\s*\)/);
      expect(questionDialog).toMatch(/invokeGenerateQuestions\s*\(\s*req\s*\)/);
    });

    it("retains the Career Track AI Translate caller", () => {
      const careerTrackEditor = readSource(
        rootDir,
        "src/pages/instructor-career-tracks/InstructorCareerTrackEditorPage.tsx",
      );

      expect(careerTrackEditor).toMatch(/invokeGenerateDescription\s*\(\s*\{/);
      expect(careerTrackEditor).toMatch(/action:\s*["']translate["']/);
      expect(careerTrackEditor).toMatch(/bundleKind:\s*["']course_info["']/);
      expect(careerTrackEditor).toMatch(/careerTrackId:\s*id/);
      expect(careerTrackEditor).not.toMatch(
        /invokeGenerateDescription\s*\(\s*\{[\s\S]*?bundleKind:\s*["']course_info["'][\s\S]*?courseId:\s*id[\s\S]*?\}\s*\)/,
      );
    });

    it("statically enforces the Career Track translation resource contract", () => {
      const content = readSource(
        rootDir,
        "supabase/functions/generate-description/index.ts",
      );

      expect(content).toContain('parseOptionalResourceId(body.careerTrackId, "careerTrackId")');
      expect(content).toContain("Không được gửi đồng thời courseId và careerTrackId.");
      expect(content).toContain("careerTrackId chỉ hợp lệ cho luồng dịch toàn bộ Career Track.");
      expect(content).toMatch(
        /async function ensureCanManageCareerTrack[\s\S]*?\.from\("career_tracks"\)[\s\S]*?\.eq\("id", careerTrackId\)[\s\S]*?if \(error \|\| !data\)[\s\S]*?if \(role === "admin" \|\| role === "support_staff"\) return/,
      );
    });

    it("statically proves privileged course bypass happens only after course existence lookup", () => {
      const descriptionFunction = readSource(
        rootDir,
        "supabase/functions/generate-description/index.ts",
      );
      const questionFunction = readSource(
        rootDir,
        "supabase/functions/generate-questions/index.ts",
      );

      expect(descriptionFunction).toMatch(
        /async function ensureCanManageCourse[\s\S]*?const row = await getCourseAccessRow\(db, courseId\)[\s\S]*?if \(role === "admin" \|\| role === "support_staff"\) return/,
      );
      expect(questionFunction).toMatch(
        /async function ensureCanManageCourse[\s\S]*?\.from\("courses"\)[\s\S]*?if \(error \|\| !data\)[\s\S]*?if \(role === "admin" \|\| role === "support_staff"\) return/,
      );
    });

    it("statically keeps section, lesson, and source lessons scoped to their course", () => {
      const descriptionFunction = readSource(
        rootDir,
        "supabase/functions/generate-description/index.ts",
      );
      const questionFunction = readSource(
        rootDir,
        "supabase/functions/generate-questions/index.ts",
      );

      expect(descriptionFunction).toContain("resolveAndValidateCourseScope");
      expect(descriptionFunction).toContain("Nguồn bài học không thuộc khoá học đã yêu cầu.");
      expect(questionFunction).toContain("ensureQuestionResourcesBelongToCourse");
      expect(questionFunction).toContain("Nguồn bài học không thuộc khoá học đã yêu cầu.");
    });
  });

  describe("WC-10: Provider configuration is explicit and secret-only", () => {
    it("documents that provider secrets are retained only for instructor-facing generators", () => {
      const envExample = readFileSync(join(rootDir, "supabase", "functions", ".env.example"), "utf8");
      expect(envExample).toContain("retained only for instructor-facing generators");
      expect(envExample).not.toContain("CORELIA_AI_PROVIDER");
      expect(envExample).not.toMatch(/^OPENAI_API_KEY=\S+/m);
      expect(envExample).toContain("# OPENAI_API_KEY=");
      expect(envExample).toContain("# CORELIA_OPENAI_DESCRIPTION_MODEL=");
      expect(envExample).toContain("# CORELIA_OPENAI_QUESTIONS_MODEL=");
    });

    it("configures only the retained instructor generators", () => {
      const configToml = readFileSync(join(rootDir, "supabase", "config.toml"), "utf8");

      for (const fn of RETIRED_LEARNER_AI_EDGE_FUNCTIONS) {
        expect(configToml).not.toContain(`[functions.${fn}]`);
      }
      for (const fn of INSTRUCTOR_AI_EDGE_FUNCTIONS) {
        expect(configToml).toContain(`[functions.${fn}]`);
      }
      expect(configToml).not.toContain("openai_api_key");
    });
  });

  describe("WC-11 to WC-13: Payment contracts after AI retirement", () => {
    it("supports only standard 'course_purchase' and 'certificate_fee' purposes", () => {
      const p1: PaymentPurpose = "course_purchase";
      const p2: PaymentPurpose = "certificate_fee";
      expect(p1).toBe("course_purchase");
      expect(p2).toBe("certificate_fee");
    });
  });

  describe("WC-14: Learner AI database retirement", () => {
    it("keeps the destructive cleanup explicit and dependency-strict", () => {
      const migration = readFileSync(
        join(rootDir, "supabase", "migrations", "20260830212012_remove_learner_facing_ai_database.sql"),
        "utf8",
      );
      expect(migration).toContain("DROP TABLE public.ai_chat_sessions;");
      expect(migration).toContain("DROP TABLE public.knowledge_chunks;");
      expect(migration).not.toMatch(/DROP\s+(?:TABLE|FUNCTION)[^;]*\sCASCADE\b/i);
    });
  });

  describe("WC-15: Deployment permanently removes stale learner AI endpoints", () => {
    const cleanupScript = readSource(rootDir, "scripts/retire-learner-ai-edge.sh");
    for (const fn of RETIRED_LEARNER_AI_EDGE_FUNCTIONS) {
      it(`verifies ${fn} is deleted idempotently`, () => {
        expect(cleanupScript).toContain(fn);
        expect(cleanupScript).toContain("supabase functions delete");
      });
    }
  });
});
