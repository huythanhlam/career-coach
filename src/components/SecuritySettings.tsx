import { useState } from "react";
import { Save, LogOut, AlertTriangle, Mail, Phone, User, KeyRound, RotateCcw } from "lucide-react";
import { useUserProfile } from "@/context/UserProfileContext";
import { useAuth } from "@/context/AuthContext";
import { MFAEnrollSection } from "@/components/MFAEnrollSection";
import { supabase } from "@/lib/supabaseClient";

const iStyle: React.CSSProperties = {
  background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12,
  height: 42, fontSize: 14, padding: "0 14px", color: "var(--foreground)",
  width: "100%", outline: "none", fontFamily: "inherit",
};
const lStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 6,
  display: "block", textTransform: "uppercase", letterSpacing: "0.05em",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <h2 className="text-sm font-bold mb-5" style={{ color: "var(--foreground)" }}>{title}</h2>
      {children}
    </div>
  );
}

function StatusMsg({ msg }: { msg: { text: string; error: boolean } | null }) {
  if (!msg) return null;
  return (
    <p className="text-xs mt-2" role="status" style={{ color: msg.error ? "var(--destructive)" : "var(--forest)" }}>
      {msg.text}
    </p>
  );
}

export function SecuritySettings() {
  const { profile, updateProfile, resetProfile } = useUserProfile();
  const { user, signOut } = useAuth();

  /* identity fields */
  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [preferredName, setPreferredName] = useState(profile.preferredName ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [identityMsg, setIdentityMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [savingIdentity, setSavingIdentity] = useState(false);

  /* password change */
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  /* delete */
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSaveIdentity() {
    setSavingIdentity(true);
    setIdentityMsg(null);
    const newEmail = email.trim();

    await updateProfile({
      fullName: fullName.trim(),
      preferredName: preferredName.trim(),
      email: newEmail,
      phone: phone.trim() || undefined,
    });

    if (user && newEmail && newEmail !== user.email) {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) {
        setIdentityMsg({ text: `Could not update email: ${error.message}`, error: true });
      } else {
        setIdentityMsg({ text: `Confirmation sent to ${newEmail}. Check your inbox.`, error: false });
      }
    } else {
      setIdentityMsg({ text: "Details saved.", error: false });
    }
    setSavingIdentity(false);
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: "Passwords do not match.", error: true });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ text: "Password must be at least 8 characters.", error: true });
      return;
    }
    setSavingPassword(true);
    setPasswordMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordMsg({ text: error.message, error: true });
    } else {
      setPasswordMsg({ text: "Password updated successfully.", error: false });
      setNewPassword("");
      setConfirmPassword("");
    }
    setSavingPassword(false);
  }

  async function handleDeleteAccount() {
    if (!confirm("Permanently delete your account and all data? This cannot be undone.")) return;
    setDeletingAccount(true);
    setDeleteError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
      { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` } }
    );
    if (res.ok) {
      await signOut();
    } else {
      const body = await res.json().catch(() => ({}));
      setDeleteError(body.error ?? "Failed to delete account. Please try again.");
      setDeletingAccount(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "var(--background)" }}>

      {/* Header */}
      <div className="px-8 py-6 flex-shrink-0" style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
        <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}>
          Security & Account
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          Manage your name, contact info, password, and two-factor authentication.
        </p>
      </div>

      <div className="flex-1 p-8 flex flex-col gap-6 max-w-2xl">

        {/* Identity */}
        <Section title="Personal Details">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={lStyle}><User className="w-3 h-3 inline mr-1" />Full Name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Smith" style={iStyle} />
            </div>
            <div>
              <label style={lStyle}>Preferred Name</label>
              <input type="text" value={preferredName} onChange={(e) => setPreferredName(e.target.value)} placeholder="Jane" style={iStyle} />
            </div>
            <div>
              <label style={lStyle}><Mail className="w-3 h-3 inline mr-1" />Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" autoComplete="email" style={iStyle} />
            </div>
            <div>
              <label style={lStyle}><Phone className="w-3 h-3 inline mr-1" />Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" autoComplete="tel" style={iStyle} />
            </div>
          </div>
          <StatusMsg msg={identityMsg} />
          <button
            onClick={handleSaveIdentity}
            disabled={savingIdentity}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            <Save className="w-4 h-4" />
            {savingIdentity ? "Saving…" : "Save Details"}
          </button>
        </Section>

        {/* Password */}
        <Section title="Change Password">
          <div className="flex flex-col gap-3">
            <div>
              <label style={lStyle}><KeyRound className="w-3 h-3 inline mr-1" />New Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters" autoComplete="new-password" style={iStyle} />
            </div>
            <div>
              <label style={lStyle}>Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password" autoComplete="new-password" style={iStyle} />
            </div>
          </div>
          <StatusMsg msg={passwordMsg} />
          <button
            onClick={handleChangePassword}
            disabled={savingPassword || !newPassword}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            <KeyRound className="w-4 h-4" />
            {savingPassword ? "Updating…" : "Update Password"}
          </button>
        </Section>

        {/* MFA */}
        <Section title="Two-Factor Authentication">
          <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)", lineHeight: 1.6 }}>
            Add an authenticator app to require a 6-digit code every time you sign in. Strongly recommended.
          </p>
          <MFAEnrollSection />
        </Section>

        {/* Danger zone */}
        <Section title="Account Actions">
          <div className="flex flex-col gap-3">
            <button
              onClick={() => confirm("Reset your career profile and re-run onboarding?") && resetProfile()}
              className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70 w-full text-left"
              style={{ color: "var(--muted-foreground)" }}
            >
              <RotateCcw className="w-4 h-4 flex-shrink-0" />
              Reset career profile &amp; re-run onboarding
            </button>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70 w-full text-left"
              style={{ color: "var(--muted-foreground)" }}
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              Sign out
            </button>

            <div className="pt-3 mt-1" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ color: "var(--destructive)" }}
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {deletingAccount ? "Deleting account…" : "Delete account permanently"}
              </button>
              {deleteError && (
                <p className="text-xs mt-2" role="alert" style={{ color: "var(--destructive)" }}>{deleteError}</p>
              )}
              <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>
                This permanently deletes your account, profile, and all saved data. Cannot be undone.
              </p>
            </div>
          </div>
        </Section>

      </div>
    </div>
  );
}
