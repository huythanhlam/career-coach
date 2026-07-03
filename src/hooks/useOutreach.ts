import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import type {
  OutreachContact,
  NewOutreachContact,
  OutreachStatus,
  PersonaType,
  OutreachType,
  OutreachTone,
} from "@/types/outreach";

// Outreach tracker data hook — reads/writes the `outreach_contacts` table.
// Mirrors the useInterviewSessions shape (list + add + update + delete).

function rowToContact(row: Record<string, unknown>): OutreachContact {
  return {
    id: row.id as string,
    company: (row.company as string) ?? "",
    targetCompanyId: (row.target_company_id as string) ?? undefined,
    contactName: (row.contact_name as string) ?? undefined,
    contactTitle: (row.contact_title as string) ?? undefined,
    contactLinkedin: (row.contact_linkedin as string) ?? undefined,
    personaType: (row.persona_type as PersonaType) ?? undefined,
    outreachType: (row.outreach_type as OutreachType) ?? undefined,
    tone: (row.tone as OutreachTone) ?? undefined,
    messageDraft: (row.message_draft as string) ?? undefined,
    status: (row.status as OutreachStatus) ?? "to_reach_out",
    jobPostingId: (row.job_posting_id as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    lastContactedAt: (row.last_contacted_at as string) ?? undefined,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

export function useOutreach() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<OutreachContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("outreach_contacts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setContacts((data as Record<string, unknown>[]).map(rowToContact));
        setLoading(false);
      });
  }, [user?.id]);

  const addContact = useCallback(
    async (contact: NewOutreachContact): Promise<OutreachContact | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("outreach_contacts")
        .insert({
          user_id: user.id,
          company: contact.company,
          target_company_id: contact.targetCompanyId ?? null,
          contact_name: contact.contactName ?? null,
          contact_title: contact.contactTitle ?? null,
          contact_linkedin: contact.contactLinkedin ?? null,
          persona_type: contact.personaType ?? null,
          outreach_type: contact.outreachType ?? null,
          tone: contact.tone ?? null,
          message_draft: contact.messageDraft ?? null,
          status: contact.status ?? "to_reach_out",
          job_posting_id: contact.jobPostingId ?? null,
          notes: contact.notes ?? null,
        })
        .select()
        .single();
      if (error || !data) return null;
      const mapped = rowToContact(data as Record<string, unknown>);
      setContacts((prev) => [mapped, ...prev]);
      return mapped;
    },
    [user],
  );

  const updateContact = useCallback(async (id: string, patch: Partial<OutreachContact>) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const dbPatch: Record<string, unknown> = {};
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.messageDraft !== undefined) dbPatch.message_draft = patch.messageDraft;
    if (patch.notes !== undefined) dbPatch.notes = patch.notes;
    if (patch.contactName !== undefined) dbPatch.contact_name = patch.contactName;
    if (patch.lastContactedAt !== undefined) dbPatch.last_contacted_at = patch.lastContactedAt;
    if (Object.keys(dbPatch).length === 0) return;
    await supabase.from("outreach_contacts").update(dbPatch).eq("id", id);
  }, []);

  const deleteContact = useCallback(async (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("outreach_contacts").delete().eq("id", id);
  }, []);

  return { contacts, loading, addContact, updateContact, deleteContact };
}
