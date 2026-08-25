import { useCallback, useEffect, useState } from "react";

import {
  deleteLearningPath,
  listLearningPaths,
  type LearningPath,
} from "@/lib/learningPaths";
import { useAuth } from "@/stores/authStore";

type ListState = {
  paths: LearningPath[];
  loading: boolean;
  error: string | null;
};

const INITIAL_LIST: ListState = { paths: [], loading: false, error: null };

export function useLearningPaths() {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<ListState>(INITIAL_LIST);
  const userId = user?.id;

  const refetch = useCallback(async () => {
    if (!isAuthenticated || !userId) {
      setState((prev) => (prev.paths.length > 0 ? INITIAL_LIST : prev));
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const paths = await listLearningPaths(userId);
      setState({ paths, loading: false, error: null });
    } catch (error) {
      setState({
        paths: [],
        loading: false,
        error: error instanceof Error ? error.message : "Không tải được lộ trình.",
      });
    }
  }, [isAuthenticated, userId]);

  useEffect(() => {
    let active = true;
    if (!isAuthenticated || !userId) {
      return;
    }
    void listLearningPaths(userId).then(
      (paths) => {
        if (active) setState({ paths, loading: false, error: null });
      },
      (error) => {
        if (active) {
          setState({
            paths: [],
            loading: false,
            error: error instanceof Error ? error.message : "Không tải được lộ trình.",
          });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [isAuthenticated, userId]);

  const remove = useCallback(async (id: string) => {
    try {
      await deleteLearningPath(id);
      setState((prev) => ({ ...prev, paths: prev.paths.filter((p) => p.id !== id) }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Xóa thất bại.";
      setState((prev) => ({ ...prev, error: msg }));
    }
  }, []);

  return {
    paths: state.paths,
    loading: state.loading,
    error: state.error,
    remove,
    refetch,
  };
}
