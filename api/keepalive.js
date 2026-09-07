// Pings Supabase once a day so the free-tier project never sits idle
// long enough to trigger its 1-week auto-pause (security review Finding
// 6). Triggered by the Vercel Cron entry in vercel.json — not meant to
// be called by the app itself or any user-facing code.
export default async function handler(req, res) {
  try {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) {
      res.status(500).json({ ok: false, error: "Missing Supabase env vars" });
      return;
    }
    const response = await fetch(`${url}/rest/v1/ledgers?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    res.status(200).json({ ok: true, supabaseStatus: response.status });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
