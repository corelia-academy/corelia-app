import { useMutation, useQueryClient } from "@tanstack/react-query";
import { manageProject, type ProjectManagementAction } from "@/lib/projectSubmission";

export function useProjectManagement(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ action, reason }: { action: ProjectManagementAction; reason: string }) =>
      manageProject(projectId, action, reason),
    onSuccess: async () => {
      // Project cards also appear in account, profile and hackathon queries.
      // Remove stale private detail data before refetching affected surfaces.
      client.removeQueries({ queryKey: ["projects", "editor", projectId] });
      await client.invalidateQueries();
    },
  });
}
