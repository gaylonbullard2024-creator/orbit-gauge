const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!;
const FROM_EMAIL = Deno.env.get('SENDGRID_FROM_EMAIL')!;
const FROM_NAME = Deno.env.get('SENDGRID_FROM_NAME') || 'The Crypto Investors';
const DASHBOARD_URL = 'https://app.thecryptoinvestors.com';

function welcomeHtml(name: string) {
  const firstName = (name || '').trim().split(/\s+/)[0] || 'there';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Welcome</title></head>
<body style="margin:0;padding:0;background:#0b0d12;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e5e7eb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0d12;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#11141b;border:1px solid #1f2430;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:28px 32px;border-bottom:1px solid #1f2430;">
          <div style="font-size:12px;letter-spacing:2px;color:#f7931a;font-weight:600;">THE CRYPTO INVESTORS</div>
          <div style="font-size:20px;color:#ffffff;font-weight:600;margin-top:6px;">Bitcoin Cycle Dashboard</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:22px;color:#ffffff;font-weight:600;">Welcome, ${escapeHtml(firstName)}.</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#cbd1dc;">
            You now have free access to our institutional Bitcoin Cycle Dashboard — the same signals we use to track market phases.
          </p>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#cbd1dc;">What you get:</p>
          <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.8;color:#cbd1dc;">
            <li>Live <strong style="color:#f7931a;">0–20 Cycle Score</strong> with current market phase</li>
            <li>Fear &amp; Greed, MVRV, 200W MA, Rainbow &amp; macro indicators</li>
            <li>Weekly market commentary delivered straight to your inbox every Monday</li>
          </ul>
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#f7931a;border-radius:6px;">
            <a href="${DASHBOARD_URL}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#0b0d12;text-decoration:none;">Open Dashboard →</a>
          </td></tr></table>
          <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#8b93a3;">
            Watch for our first weekly report this Monday at 9 AM ET.
          </p>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #1f2430;font-size:12px;color:#6b7280;">
          You're receiving this because you signed up for free dashboard access at thecryptoinvestors.com.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { email, name } = await req.json();
    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'email required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject: 'Welcome to the Bitcoin Cycle Dashboard',
        content: [{ type: 'text/html', value: welcomeHtml(name || '') }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('SendGrid welcome failed', res.status, body);
      return new Response(JSON.stringify({ error: 'send failed', status: res.status, body }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('welcome error', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
