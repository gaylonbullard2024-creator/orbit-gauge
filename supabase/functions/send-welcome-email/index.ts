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
<html><head><meta charset="utf-8"><title>Welcome to Orbit Gauge</title></head>
<body style="margin:0;padding:0;background:#0b0d12;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e5e7eb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0d12;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#11141b;border:1px solid #1f2430;border-radius:10px;overflow:hidden;">

        <tr><td style="padding:28px 32px 20px;border-bottom:1px solid #1f2430;">
          <div style="font-size:11px;letter-spacing:2.5px;color:#f7931a;font-weight:700;">ORBIT GAUGE</div>
          <div style="font-size:13px;letter-spacing:1px;color:#8b93a3;margin-top:4px;">BITCOIN CYCLE INTELLIGENCE</div>
        </td></tr>

        <tr><td style="padding:36px 32px 8px;">
          <div style="font-size:11px;letter-spacing:2px;color:#f7931a;font-weight:600;margin-bottom:12px;">YOU'RE IN, ${escapeHtml(firstName.toUpperCase())}</div>
          <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;color:#ffffff;font-weight:600;">Track the Bitcoin cycle like an institution.</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#cbd1dc;">
            Orbit Gauge distills the signals professional desks watch — on-chain, technical, sentiment, and macro — into a single 0–20 score so you always know where we are in the cycle.
          </p>
        </td></tr>

        <tr><td style="padding:0 32px 24px;" align="center">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#f7931a;border-radius:6px;">
            <a href="${DASHBOARD_URL}" style="display:inline-block;padding:16px 36px;font-size:15px;font-weight:700;color:#0b0d12;text-decoration:none;letter-spacing:0.3px;">Launch Orbit Gauge →</a>
          </td></tr></table>
          <div style="font-size:12px;color:#6b7280;margin-top:12px;">Free access · No credit card</div>
        </td></tr>

        <tr><td style="padding:8px 32px 28px;">
          <div style="font-size:11px;letter-spacing:1.5px;color:#8b93a3;margin-bottom:14px;">WHAT'S INSIDE</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:10px 0;border-bottom:1px solid #1f2430;">
              <div style="font-size:14px;color:#ffffff;font-weight:600;">Cycle Gauge <span style="color:#f7931a;">0–20</span></div>
              <div style="font-size:13px;color:#8b93a3;margin-top:2px;">Live phase read — Accumulation, Expansion, Euphoria, Capitulation.</div>
            </td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #1f2430;">
              <div style="font-size:14px;color:#ffffff;font-weight:600;">Core Indicators</div>
              <div style="font-size:13px;color:#8b93a3;margin-top:2px;">MVRV, 200W MA, Rainbow Chart, Fear &amp; Greed, macro liquidity &amp; DXY.</div>
            </td></tr>
            <tr><td style="padding:10px 0;">
              <div style="font-size:14px;color:#ffffff;font-weight:600;">Weekly Briefing</div>
              <div style="font-size:13px;color:#8b93a3;margin-top:2px;">Monday 9 AM ET — phase, score, WoW deltas, and our take.</div>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:20px 32px;border-top:1px solid #1f2430;font-size:12px;color:#6b7280;line-height:1.6;">
          You're receiving this because you signed up at thecryptoinvestors.com. Not investment advice.
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
