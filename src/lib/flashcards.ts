import { supabaseFunctionHeaders } from "./coreliaEdgeApi";
import { supabase } from "./supabase";

export type FlashcardBucket = "new" | "good" | "easy";

export type FlashcardReviewAction = "again" | "good" | "easy";

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  bucket: FlashcardBucket;
  next_review_at: string;
  last_reviewed_at: string | null;
  review_count: number;
};

export type FlashcardDeck = {
  id: string;
  cards: Flashcard[];
  locale: "vi" | "en";
  createdAt: string;
  updatedAt: string;
};

export type GenerateFlashcardsRequest = {
  lessonId: string;
  courseId: string;
  locale?: "vi" | "en";
  force?: boolean;
  count?: number;
};

export type GenerateFlashcardsResponse = {
  cached: boolean;
  deck: FlashcardDeck;
};

function flashcardsFunctionUrl(): string {
  const explicit = import.meta.env.VITE_GENERATE_FLASHCARDS_FUNCTION_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (!supabaseUrl) return "";
  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/generate-flashcards`;
}

function normalizeCards(input: unknown): Flashcard[] {
  if (!Array.isArray(input)) return [];
  const out: Flashcard[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id : "";
    const front = typeof obj.front === "string" ? obj.front : "";
    const back = typeof obj.back === "string" ? obj.back : "";
    if (!id || !front || !back) continue;
    const bucket: FlashcardBucket =
      obj.bucket === "good" || obj.bucket === "easy" ? obj.bucket : "new";
    out.push({
      id,
      front,
      back,
      bucket,
      next_review_at:
        typeof obj.next_review_at === "string"
          ? obj.next_review_at
          : new Date().toISOString(),
      last_reviewed_at:
        typeof obj.last_reviewed_at === "string" ? obj.last_reviewed_at : null,
      review_count: typeof obj.review_count === "number" ? obj.review_count : 0,
    });
  }
  return out;
}

export async function invokeGenerateFlashcards(
  body: GenerateFlashcardsRequest,
): Promise<GenerateFlashcardsResponse> {
  const url = flashcardsFunctionUrl();
  if (!url) throw new Error("Missing Supabase functions URL");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Bạn cần đăng nhập để dùng tính năng này.");

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        ...supabaseFunctionHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Không kết nối được Edge Function generate-flashcards.");
  }

  const payload = (await res.json().catch(() => ({}))) as {
    cached?: boolean;
    deck?: {
      id: string;
      cards: unknown;
      locale: "vi" | "en";
      createdAt: string;
      updatedAt: string;
    };
    message?: string;
  };
  if (!res.ok) {
    throw new Error(payload.message?.trim() || `http_error:${res.status}`);
  }
  if (!payload.deck) {
    throw new Error("Phản hồi flashcards không hợp lệ.");
  }
  return {
    cached: Boolean(payload.cached),
    deck: {
      id: payload.deck.id,
      cards: normalizeCards(payload.deck.cards),
      locale: payload.deck.locale,
      createdAt: payload.deck.createdAt,
      updatedAt: payload.deck.updatedAt,
    },
  };
}

export async function fetchFlashcardDeck(args: {
  userId: string;
  lessonId: string;
  locale?: "vi" | "en";
}): Promise<FlashcardDeck | null> {
  let query = supabase
    .from("flashcard_decks")
    .select("id,cards,locale,created_at,updated_at")
    .eq("user_id", args.userId)
    .eq("lesson_id", args.lessonId);
  if (args.locale) query = query.eq("locale", args.locale);
  const { data, error } = await query.maybeSingle<{
      id: string;
      cards: unknown;
      locale: "vi" | "en";
      created_at: string;
      updated_at: string;
    }>();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    cards: normalizeCards(data.cards),
    locale: data.locale,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function applyReview(card: Flashcard, action: FlashcardReviewAction): Flashcard {
  const now = new Date();
  let bucket: FlashcardBucket;
  let daysAhead: number;
  if (action === "again") {
    bucket = "new";
    daysAhead = 0;
  } else if (action === "good") {
    bucket = "good";
    daysAhead = 3;
  } else {
    bucket = "easy";
    daysAhead = 7;
  }
  return {
    ...card,
    bucket,
    last_reviewed_at: now.toISOString(),
    next_review_at: new Date(now.getTime() + daysAhead * DAY_MS).toISOString(),
    review_count: card.review_count + 1,
  };
}

export async function persistDeckCards(args: {
  deckId: string;
  cards: Flashcard[];
}): Promise<void> {
  const { error } = await supabase
    .from("flashcard_decks")
    .update({ cards: args.cards, updated_at: new Date().toISOString() })
    .eq("id", args.deckId);
  if (error) throw new Error(error.message);
}

export function isDueToday(card: Flashcard, reference: Date = new Date()): boolean {
  if (card.review_count === 0) return true;
  const due = new Date(card.next_review_at).getTime();
  return due <= reference.getTime();
}
