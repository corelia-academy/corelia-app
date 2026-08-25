import { useCallback, useEffect, useState } from "react";

import i18n from "@/i18n";
import {
  applyReview,
  fetchFlashcardDeck,
  persistDeckCards,
  type Flashcard,
  type FlashcardDeck,
  type FlashcardReviewAction,
} from "@/lib/flashcards";
import { useAuth } from "@/stores/authStore";

type State = {
  deck: FlashcardDeck | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
};

const INITIAL_STATE: State = {
  deck: null,
  loading: false,
  saving: false,
  error: null,
};

export function useFlashcardDeck(params: {
  lessonId: string | null | undefined;
  courseId?: string | null | undefined;
  locale?: "vi" | "en";
}) {
  const { lessonId, locale } = params;
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
        saving: false,
        error: null,
      });
    } catch (error) {
      setState({
        deck: null,
        loading: false,
        saving: false,
        error: error instanceof Error ? error.message : i18n.t("courses:errors.flashcards.loadFailed"),
      });
    }
  }, [isAuthenticated, lessonId, locale, user?.id]);

  useEffect(() => {
    void fetchExisting();
  }, [fetchExisting]);

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
    saving: state.saving,
    error: state.error,
    submitReview,
    refetch: fetchExisting,
  };
}
