import { useState, useEffect } from "react";
import type { UserProfile } from "@/types/userProfile";
import { parseProfileFromImport } from "@/services/geminiService";
import { useUserProfile } from "@/context/UserProfileContext";
import { useAuth } from "@/context/AuthContext";
import { uploadImportedResume, uploadLinkedInText } from "@/services/resumeStorageService";
import { ConsentStep } from "./steps/ConsentStep";
import { WelcomeStep } from "./steps/WelcomeStep";
import { AccountTypeStep } from "./steps/AccountTypeStep";
import { ImportStep } from "./steps/ImportStep";
import { ExtractingStep } from "./steps/ExtractingStep";
import { ReviewStep } from "./steps/ReviewStep";
import { DoneStep } from "./steps/DoneStep";
import type { AccountType } from "@/types/userProfile";
import { readPendingAccountType, clearPendingAccountType } from "@/lib/accountMode";

type Step = "consent" | "welcome" | "account_type" | "import" | "extracting" | "review" | "done";
type ImportInput =
  { type: "linkedin"; text: string; url?: string } | { type: "resume"; text: string };

export function OnboardingWizard() {
  const { updateProfile } = useUserProfile();
  const { session } = useAuth();
  const [step, setStep] = useState<Step>("consent");
  const [importInput, setImportInput] = useState<ImportInput | null>(null);
  const [extracted, setExtracted] = useState<Partial<UserProfile>>({});
  const [extractionError, setExtractionError] = useState<string | undefined>();
  const [savedPreferredName, setSavedPreferredName] = useState("");
  // A pending account type chosen on the landing page (e.g. the employer signup
  // path) seeds the flow and lets us skip the in-app account-type question.
  const [accountType, setAccountType] = useState<AccountType>(
    () => readPendingAccountType() ?? "seeker",
  );
  const cameInAsEmployer = accountType === "employer";

  function finishAsEmployer() {
    clearPendingAccountType();
    updateProfile({ accountType: "employer", onboardingComplete: true });
    setStep("done");
  }

  function handleConsent() {
    updateProfile({ aiConsentGivenAt: new Date().toISOString() });
    setStep("welcome");
  }

  function handleWelcomeStart() {
    // Employer signups skip the account-type question and the seeker-only
    // resume import; everyone else picks their role next.
    if (cameInAsEmployer) finishAsEmployer();
    else setStep("account_type");
  }

  function handleSkip() {
    clearPendingAccountType();
    updateProfile({ accountType, onboardingComplete: true });
  }

  function handleAccountType(type: AccountType) {
    setAccountType(type);
    if (type === "employer") {
      // Employers skip the resume-import flow — that's seeker-specific.
      clearPendingAccountType();
      updateProfile({ accountType: type, onboardingComplete: true });
      setStep("done");
    } else {
      updateProfile({ accountType: type });
      setStep("import");
    }
  }

  async function runExtraction(input: ImportInput) {
    setImportInput(input);
    setStep("extracting");
    setExtractionError(undefined);
    try {
      const result = await parseProfileFromImport(input);
      if (!result || Object.keys(result).length === 0) {
        throw new Error(
          "No profile data could be extracted. Please check your input and try again.",
        );
      }
      setExtracted(result);
      setStep("review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setExtractionError(msg);
    }
  }

  async function handleConfirm(profile: Partial<UserProfile>) {
    setSavedPreferredName(profile.preferredName ?? profile.fullName?.split(" ")[0] ?? "");
    const userId = session?.user?.id;
    const updates: Partial<UserProfile> = { ...profile, accountType, onboardingComplete: true };
    if (userId && importInput) {
      try {
        if (importInput.type === "resume") {
          updates.resumeStoragePath = await uploadImportedResume(userId, importInput.text);
        } else if (importInput.type === "linkedin") {
          updates.linkedinStoragePath = await uploadLinkedInText(userId, importInput.text);
        }
      } catch (err) {
        console.error("Failed to upload import to storage:", err);
      }
    }
    updateProfile(updates);
    setStep("done");
  }

  function handleDone() {
    // Profile already saved, wizard dismisses via context (onboardingComplete: true)
    // The wizard overlay will unmount automatically since App.tsx checks onboardingComplete
  }

  // Progress indicator dots (consent is a gate, not a numbered step)
  const steps: Step[] = ["welcome", "account_type", "import", "review", "done"];
  const progressIndex = steps.indexOf(step === "extracting" ? "import" : step);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(31,27,22,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative flex flex-col w-full mx-4 overflow-hidden"
        style={{
          maxWidth: step === "import" || step === "review" ? 680 : 520,
          maxHeight: "90vh",
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 24,
          boxShadow: "0 24px 80px rgba(31,27,22,0.22)",
        }}
      >
        {/* Progress dots — hidden on consent gate */}
        {step !== "done" && step !== "consent" && (
          <div className="flex justify-center gap-1.5 pt-5 pb-1">
            {steps
              .filter((s) => s !== "done")
              .map((s, i) => (
                <div
                  key={s}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === progressIndex ? 20 : 6,
                    height: 6,
                    background: i <= progressIndex ? "var(--primary)" : "var(--border)",
                  }}
                />
              ))}
          </div>
        )}

        {/* Step content */}
        <div
          className={`flex-1 overflow-y-auto ${step === "review" ? "" : "flex items-center justify-center"}`}
        >
          {step === "consent" && <ConsentStep onAgree={handleConsent} />}
          {step === "welcome" && (
            <WelcomeStep
              onStart={handleWelcomeStart}
              onSkip={handleSkip}
              accountType={accountType}
            />
          )}
          {step === "account_type" && <AccountTypeStep onSelect={handleAccountType} />}
          {step === "import" && (
            <ImportStep
              onExtract={runExtraction}
              onBack={() => setStep("welcome")}
              onSkip={handleSkip}
            />
          )}
          {step === "extracting" && (
            <ExtractingStep
              importType={importInput?.type ?? "resume"}
              error={extractionError}
              onRetry={() => importInput && runExtraction(importInput)}
              onSkip={handleSkip}
            />
          )}
          {step === "review" && (
            <ReviewStep
              extracted={extracted}
              onConfirm={handleConfirm}
              onBack={() => setStep("import")}
              onSkip={handleSkip}
            />
          )}
          {step === "done" && (
            <DoneStep name={savedPreferredName} onStart={handleDone} accountType={accountType} />
          )}
        </div>
      </div>
    </div>
  );
}
