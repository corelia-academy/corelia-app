import { createContext, useContext } from "react";
import type { ContestDetailViewModel } from "@/pages/contest-detail/viewModel";

type ContestDetailContextValue = {
  vm: ContestDetailViewModel;
};

const ContestDetailContext = createContext<ContestDetailContextValue | null>(null);

export function ContestDetailProvider({
  vm,
  children,
}: {
  vm: ContestDetailViewModel;
  children: React.ReactNode;
}) {
  return (
    <ContestDetailContext.Provider value={{ vm }}>
      {children}
    </ContestDetailContext.Provider>
  );
}

export function useContestDetailVm(): ContestDetailViewModel {
  const ctx = useContext(ContestDetailContext);
  if (!ctx) {
    throw new Error("useContestDetailVm must be used within ContestDetailProvider");
  }
  return ctx.vm;
}

