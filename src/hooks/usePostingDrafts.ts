import type { ViewId } from "@/components/Sidebar";

interface UsePostingDraftsOptions {
  onNavigate?: (view: ViewId) => void;
}

export function usePostingDrafts({ onNavigate }: UsePostingDraftsOptions) {
  const handleGenerateCoverLetter = () => {
    onNavigate?.("cover_letter");
  };

  const handleTailorResume = () => {
    onNavigate?.("resume_generation");
  };

  return { handleGenerateCoverLetter, handleTailorResume };
}
