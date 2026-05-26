import { useCallback, useEffect, useState } from "react";

import {
  deleteLearningPath,
  invokeGenerateLearningPath,
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
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setState(INITIAL_LIST);
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const paths = await listLearningPaths(user.id);
      setState({ paths, loading: false, error: null });
    } catch (error) {
      setState({
        paths: [],
        loading: false,
        error: error instanceof Error ? error.message : "Không tải được lộ trình.",
      });
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const generate = useCallback(
    async (args: { goal: string; locale?: "vi" | "en"; force?: boolean }) => {
      setGenerateError(null);
      setGenerating(true);
      try {
        const res = await invokeGenerateLearningPath(args);
        // Merge into list (replace if same id).
        setState((prev) => {
          const others = prev.paths.filter((p) => p.id !== res.path.id);
          return { ...prev, paths: [res.path, ...others] };
        });
        return res.path;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Không tạo được lộ trình.";
        setGenerateError(msg);
        return null;
      } finally {
        setGenerating(false);
      }
    },
    [],
  );

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
    generating,
    generateError,
    generate,
    remove,
    refetch,
  };
}
