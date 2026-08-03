import { useCallback, useEffect, useState } from "react";

import i18n from "@/i18n";
import {
  applyReview,
  fetchFlashcardDeck,
  invokeGenerateFlashcards,
  persistDeckCards,
  type Flashcard,
  type FlashcardDeck,
  type FlashcardReviewAction,
} from "@/lib/flashcards";
import { useAuth } from "@/stores/authStore";

type State = {
  deck: FlashcardDeck | null;
  loading: boolean;
  generating: boolean;
  saving: boolean;
  error: string | null;
};

const INITIAL_STATE: State = {
  deck: null,
  loading: false,
  generating: false,
  saving: false,
  error: null,
};

export function useFlashcardDeck(params: {
  lessonId: string | null | undefined;
  courseId: string | null | undefined;
  locale?: "vi" | "en";
}) {
  const { lessonId, courseId, locale } = params;
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<State>(INITIAL_STATE);

  const fetchExisting = useCallback(async () => {
    if (!isAuthenticated || !user?.id || !lessonId) {
      setState(INITIAL_STATE);
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const deck = await fetchFlashcardDeck({ userId: user.id, lessonId, locale });
      setState({
        deck,
        loading: false,
        generating: false,
        saving: false,
        error: null,
      });
    } catch (error) {
      setState({
        deck: null,
        loading: false,
        generating: false,
        saving: false,
        error: error instanceof Error ? error.message : i18n.t("courses:errors.flashcards.loadFailed"),
      });
    }
  }, [isAuthenticated, lessonId, locale, user?.id]);

  useEffect(() => {
    void fetchExisting();
  }, [fetchExisting]);

  const generate = useCallback(
    async (options?: { force?: boolean; count?: number }) => {
      if (!lessonId || !courseId) return null;
      if (!isAuthenticated) {
        setState((prev) => ({
          ...prev,
          error: i18n.t("courses:errors.mustLoginFeature"),
        }));
        return null;
      }
      setState((prev) => ({ ...prev, generating: true, error: null }));
      try {
        const response = await invokeGenerateFlashcards({
          lessonId,
          courseId,
          locale,
          force: options?.force,
          count: options?.count,
        });
        setState({
          deck: response.deck,
          loading: false,
          generating: false,
          saving: false,
          error: null,
        });
        return response.deck;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          generating: false,
          error:
            error instanceof Error
              ? error.message
              : i18n.t("courses:errors.flashcards.generateFailed"),
        }));
        return null;
      }
    },
    [courseId, isAuthenticated, lessonId, locale],
  );

  const submitReview = useCallback(
    async (cardId: string, action: FlashcardReviewAction) => {
      if (!state.deck) return;
      const nextCards: Flashcard[] = state.deck.cards.map((card) =>
        card.id === cardId ? applyReview(card, action) : card,
      );
      const nextDeck: FlashcardDeck = { ...state.deck, cards: nextCards };
      setState((prev) => ({ ...prev, deck: nextDeck, saving: true, error: null }));
      try {
        await persistDeckCards({ deckId: nextDeck.id, cards: nextCards });
        setState((prev) => ({ ...prev, saving: false }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          saving: false,
          error: error instanceof Error ? error.message : i18n.t("courses:errors.flashcards.saveFailed"),
        }));
      }
    },
    [state.deck],
  );

  return {
    deck: state.deck,
    loading: state.loading,
    generating: state.generating,
    saving: state.saving,
    error: state.error,
    generate,
    submitReview,
    refetch: fetchExisting,
  };
}
