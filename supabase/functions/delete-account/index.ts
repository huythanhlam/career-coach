import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Decode the `aal` (Authenticator Assurance Level) claim from a Supabase JWT
// without verifying the signature — the token is independently verified by
// `auth.getUser()`; we only read the claim here. Returns null if absent.
function readAal(authHeader: string): string | null {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.aal === "string" ? json.aal : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    // Verify the caller is authenticated using their JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401, cors);

    // Use anon client to verify the JWT and get the user
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401, cors);

    // Use service role for privileged reads/writes (cascades to profiles via FK)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Step-up requirement: deleting an account is irreversible, so an
    // MFA-enrolled user must present an aal2 (MFA-verified) session. This
    // prevents a stolen password-only session from wiping the account.
    const { data: profile } = await adminClient
      .from("profiles")
      .select("mfa_enrolled")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.mfa_enrolled && readAal(authHeader) !== "aal2") {
      return json(
        { error: "aal2_required", message: "Complete MFA verification before deleting your account." },
        403,
        cors,
      );
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) return json({ error: deleteError.message }, 500, cors);

    return json({ success: true }, 200, cors);
  } catch (err) {
    return json({ error: String(err) }, 500, cors);
  }
});
