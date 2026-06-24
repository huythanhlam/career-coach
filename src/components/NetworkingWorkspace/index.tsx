import { useState } from "react";
import { Users, Search, Loader2, ListChecks } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserProfile } from "@/context/UserProfileContext";
import { useOutreach } from "@/hooks/useOutreach";
import { suggestOutreachTargets } from "@/services/networkingService";
import { getCompanyProfile } from "@/services/companyProfileService";
import type { CompanyProfile } from "@/types/companyProfile";
import type { OutreachTarget, NewOutreachContact } from "@/types/outreach";
import { PersonaList } from "./PersonaList";
import { OutreachComposer } from "./OutreachComposer";
import { OutreachTracker } from "./OutreachTracker";

type Tab = "find" | "tracker";

/** Condense a deterministic company profile into a short prompt-ready intel blurb. */
function buildCompanyIntel(profile: CompanyProfile | null): string {
  if (!profile) return "";
  const lines: string[] = [];
  if (profile.overview) lines.push(profile.overview.slice(0, 600));
  const f = profile.keyFacts ?? {};
  const facts = [
    f.industry && `Industry: ${f.industry}`,
    f.headquarters && `HQ: ${f.headquarters}`,
    f.employeeCount && `Employees: ${f.employeeCount}`,
    f.ceo && `CEO: ${f.ceo}`,
  ].filter(Boolean);
  if (facts.length) lines.push(facts.join(" · "));
  return lines.join("\n");
}

export function NetworkingWorkspace() {
  const { profile } = useUserProfile();
  const { contacts, addContact, updateContact, deleteContact } = useOutreach();

  const [tab, setTab] = useState<Tab>("find");
  const [company, setCompany] = useState("");
  const [searchedCompany, setSearchedCompany] = useState("");
  const [companyIntel, setCompanyIntel] = useState("");
  const [targets, setTargets] = useState<OutreachTarget[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [composing, setComposing] = useState<OutreachTarget | null>(null);

  const handleFind = async () => {
    const name = company.trim();
    if (!name) { setError("Enter a company name."); return; }
    setError("");
    setIsSearching(true);
    setTargets([]);
    try {
      const cp = await getCompanyProfile(name).catch(() => null);
      const intel = buildCompanyIntel(cp);
      setCompanyIntel(intel);
      const result = await suggestOutreachTargets({ company: name, companyIntel: intel, profile });
      setTargets(result);
      setSearchedCompany(name);
      if (result.length === 0) setError("Couldn't suggest targets this time — please try again.");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSave = async (contact: NewOutreachContact) => {
    await addContact(contact);
    setTab("tracker");
  };

  const openCount = contacts.filter((c) => c.status !== "closed").length;

  const tabBtn = (id: Tab, label: string, icon: React.ReactNode, badge?: number) => (
    <button
      onClick={() => setTab(id)}
      className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-colors"
      style={{
        background: tab === id ? "var(--card)" : "transparent",
        color: tab === id ? "var(--foreground)" : "var(--muted-foreground)",
        border: tab === id ? "1px solid var(--border)" : "1px solid transparent",
        cursor: "pointer",
      }}
    >
      {icon}
      {label}
      {badge != null && badge > 0 && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(217,119,87,0.12)", color: "var(--primary)" }}>{badge}</span>
      )}
    </button>
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--muted)" }}>
      {/* Header */}
      <div className="px-4 sm:px-8 pt-6 pb-3 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(217,119,87,0.12)", color: "var(--primary)" }}>
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold" style={{ color: "var(--foreground)" }}>Networking & Referrals</h1>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Find the right people at a company and send outreach that actually gets replies.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tabBtn("find", "Find people", <Search className="w-4 h-4" />)}
          {tabBtn("tracker", "Tracker", <ListChecks className="w-4 h-4" />, openCount)}
        </div>
      </div>

      {/* Body */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 sm:px-8 pb-10 max-w-2xl mx-auto w-full flex flex-col gap-5">
          {tab === "find" ? (
            <>
              <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Target company</label>
                <div className="flex gap-2">
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleFind(); }}
                    placeholder="e.g. Stripe"
                    className="flex-1 h-11 rounded-xl px-3 text-sm"
                    style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  />
                  <button
                    onClick={handleFind}
                    disabled={isSearching}
                    className="h-11 px-5 rounded-xl text-sm font-semibold flex items-center gap-2"
                    style={{ background: "var(--primary)", color: "#fff", border: "none", opacity: isSearching ? 0.6 : 1, cursor: isSearching ? "not-allowed" : "pointer" }}
                  >
                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Find people
                  </button>
                </div>
                {error && <p className="text-xs" style={{ color: "var(--primary)" }}>{error}</p>}
              </div>

              {targets.length > 0 && (
                <PersonaList company={searchedCompany} targets={targets} onDraft={setComposing} />
              )}
            </>
          ) : (
            <OutreachTracker contacts={contacts} onUpdate={updateContact} onDelete={deleteContact} />
          )}
        </div>
      </ScrollArea>

      {composing && (
        <OutreachComposer
          company={searchedCompany}
          companyIntel={companyIntel}
          target={composing}
          onClose={() => setComposing(null)}
          onSave={async (c) => { await handleSave(c); setComposing(null); }}
        />
      )}
    </div>
  );
}
