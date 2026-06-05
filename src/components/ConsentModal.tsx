import { useUserProfile } from "@/context/UserProfileContext";
import { ConsentStep } from "@/components/onboarding/steps/ConsentStep";

export function ConsentModal() {
  const { updateProfile } = useUserProfile();

  function handleAgree() {
    updateProfile({ aiConsentGivenAt: new Date().toISOString() });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(31,27,22,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative w-full mx-4 overflow-hidden"
        style={{
          maxWidth: 520,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 24,
          boxShadow: "0 24px 80px rgba(31,27,22,0.22)",
        }}
      >
        <ConsentStep onAgree={handleAgree} />
      </div>
    </div>
  );
}
