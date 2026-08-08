// Sends a real invite email via Brevo's transactional email API.
//
// This runs server-side (not in the browser) specifically so the Brevo API
// key never has to be exposed to anyone using the app — it lives only as a
// Supabase secret that this function reads at request time.
//
// Deploy this from the Supabase Dashboard: Edge Functions -> Deploy a new
// function -> Via Editor. Paste this file's contents in, name the function
// exactly "send-invite-email", and deploy. Then add a secret named
// BREVO_API_KEY (Edge Functions -> Manage secrets) with your Brevo SMTP/API
// key. No CLI or Docker needed.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Change this to match the sender address you verified in Brevo.
const FROM_EMAIL = "trackituae.com@gmail.com";
const FROM_NAME = "Track It";
const APP_URL = "https://www.trackituae.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { to, ledgerName, inviterName } = await req.json();
    if (!to || typeof to !== "string") {
      return new Response(JSON.stringify({ error: "Missing recipient email." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) {
      return new Response(JSON.stringify({ error: "BREVO_API_KEY secret is not set on this project." }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const safeLedgerName = String(ledgerName || "a shared ledger").slice(0, 60);
    const safeInviterName = String(inviterName || "Someone").slice(0, 60);

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1B2A24;">
        <h2 style="font-family: Georgia, serif;">You've been invited to Track It</h2>
        <p>${safeInviterName} invited you to join <strong>${safeLedgerName}</strong>, a shared expense ledger on Track It.</p>
        <p>To join, just sign up (or sign in, if you already have an account) using this exact email address — you'll be added automatically.</p>
        <p style="margin: 24px 0;">
          <a href="${APP_URL}" style="background: #C9A227; color: #1B2A24; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Open Track It
          </a>
        </p>
        <p style="font-size: 12px; color: #666;">If you weren't expecting this, you can safely ignore this email.</p>
      </div>
    `;

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: to }],
        subject: `${safeInviterName} invited you to "${safeLedgerName}" on Track It`,
        htmlContent: html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return new Response(JSON.stringify({ error: "Brevo rejected the email.", detail }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
