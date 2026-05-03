import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '@supabase/supabase-js/cors';

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!;
const FROM_EMAIL = Deno.env.get('SENDGRID_FROM_EMAIL')!;
const FROM_NAME = Deno.env.get('SENDGRID_FROM_NAME') || 'The Crypto Investors';
const DASHBOARD_URL = 'https://app.thecryptoinvestors.com';
const PROJECT_ID = Deno.env.get('SUPABASE_URL')!.match(/https:\/\/([^.]+)/)![1];
const UNSUB_BASE = `https://${PROJECT_ID}.supabase.co/functions/v1/unsubscribe`;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function escapeHtml(s: string) {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function fmtUsd(n: number | null | undefined) {
  if (n == null) return '—';
  return '$' + Math.round(n).toLocaleString('en-US');
}

function fmtPct(n: number | null | undefined) {
  if (n == null || !isFinite(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function reportHtml(opts: {
  firstName: string;
  phase: string;
  score: number | null;
  btcPrice: number | null;
  wowPct: number | null;
  headline: string | null;
  commentary: string | null;
  weekEnding: string;
  unsubUrl: string;
}) {
  const { firstName, phase, score, btcPrice, wowPct, headline, commentary, weekEnding, unsubUrl } = opts;
  const wowColor = wowPct == null ? '#cbd1dc' : wowPct >= 0 ? '#22c55e' : '#ef4444';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0b0d12;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e5e7eb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0d12;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#11141b;border:1px solid #1f2430;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:24px 32px;border-bottom:1px solid #1f2430;">
          <div style="font-size:11px;letter-spacing:2px;color:#f7931a;font-weight:600;">BTC WEEKLY · ${weekEnding}</div>
          <div style="font-size:20px;color:#ffffff;font-weight:600;margin-top:6px;">Hi ${escapeHtml(firstName)}, here's your Bitcoin cycle update.</div>
        </td></tr>

        <tr><td style="padding:24px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#0b0d12;border:1px solid #1f2430;border-radius:6px;padding:18px;width:50%;">
                <div style="font-size:11px;letter-spacing:1.5px;color:#8b93a3;">CYCLE PHASE</div>
                <div style="font-size:18px;color:#ffffff;font-weight:600;margin-top:6px;">${escapeHtml(phase)}</div>
                <div style="font-size:13px;color:#f7931a;margin-top:4px;">Score ${score ?? '—'}/20</div>
              </td>
              <td width="12"></td>
              <td style="background:#0b0d12;border:1px solid #1f2430;border-radius:6px;padding:18px;width:50%;">
                <div style="font-size:11px;letter-spacing:1.5px;color:#8b93a3;">BTC PRICE</div>
                <div style="font-size:18px;color:#ffffff;font-weight:600;margin-top:6px;">${fmtUsd(btcPrice)}</div>
                <div style="font-size:13px;color:${wowColor};margin-top:4px;">${fmtPct(wowPct)} WoW</div>
              </td>
            </tr>
          </table>
        </td></tr>

        ${headline || commentary ? `<tr><td style="padding:8px 32px 24px;">
          <div style="font-size:11px;letter-spacing:1.5px;color:#8b93a3;margin-bottom:10px;">WEEKLY COMMENTARY</div>
          ${headline ? `<h2 style="margin:0 0 12px;font-size:18px;color:#ffffff;font-weight:600;">${escapeHtml(headline)}</h2>` : ''}
          ${commentary ? `<div style="font-size:14px;line-height:1.7;color:#cbd1dc;white-space:pre-wrap;">${escapeHtml(commentary)}</div>` : ''}
        </td></tr>` : ''}

        <tr><td style="padding:8px 32px 32px;" align="center">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#f7931a;border-radius:6px;">
            <a href="${DASHBOARD_URL}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#0b0d12;text-decoration:none;">View Full Dashboard →</a>
          </td></tr></table>
        </td></tr>

        <tr><td style="padding:18px 32px;border-top:1px solid #1f2430;font-size:12px;color:#6b7280;line-height:1.6;">
          Not investment advice. You're receiving this weekly summary because you signed up at thecryptoinvestors.com.<br>
          <a href="${unsubUrl}" style="color:#8b93a3;text-decoration:underline;">Unsubscribe from weekly reports</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendOne(email: string, subject: string, html: string, unsubUrl: string) {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email }],
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SendGrid ${res.status}: ${body}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Latest snapshot + previous-week snapshot for WoW
    const { data: latest } = await supabase
      .from('dashboard_snapshots')
      .select('*')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latest) {
      return new Response(JSON.stringify({ error: 'no snapshot' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const sevenDaysAgo = new Date(latest.date);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const prevDate = sevenDaysAgo.toISOString().split('T')[0];

    const { data: prev } = await supabase
      .from('dashboard_snapshots')
      .select('btc_close_usd,date')
      .lte('date', prevDate)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const wowPct = prev?.btc_close_usd && latest.btc_close_usd
      ? ((Number(latest.btc_close_usd) - Number(prev.btc_close_usd)) / Number(prev.btc_close_usd)) * 100
      : null;

    const { data: report } = await supabase
      .from('weekly_reports')
      .select('week_ending,headline,summary_markdown')
      .order('week_ending', { ascending: false })
      .limit(1)
      .maybeSingle();

    const weekEnding = report?.week_ending || latest.date;

    // Pull all subscribed leads
    const { data: leads, error: leadsErr } = await supabase
      .from('leads')
      .select('id,email,name,unsubscribe_token')
      .is('unsubscribed_at', null);

    if (leadsErr) throw leadsErr;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, skipped: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Filter out leads already sent for this week
    const { data: alreadySent } = await supabase
      .from('weekly_email_log')
      .select('lead_id')
      .eq('week_ending', weekEnding)
      .eq('status', 'sent');
    const sentSet = new Set((alreadySent || []).map((r) => r.lead_id));

    const phase = latest.cycle_phase || 'Unknown';
    const score = latest.cycle_total_score;
    const subject = `BTC Weekly: ${phase} — Cycle Score ${score ?? '—'}/20`;

    let sent = 0, failed = 0, skipped = 0;
    for (const lead of leads) {
      if (sentSet.has(lead.id)) { skipped++; continue; }
      const unsubUrl = `${UNSUB_BASE}?token=${lead.unsubscribe_token}`;
      const html = reportHtml({
        firstName: (lead.name || '').trim().split(/\s+/)[0] || 'there',
        phase, score,
        btcPrice: latest.btc_close_usd ? Number(latest.btc_close_usd) : null,
        wowPct,
        headline: report?.headline || null,
        commentary: report?.summary_markdown || null,
        weekEnding,
        unsubUrl,
      });
      try {
        await sendOne(lead.email, subject, html, unsubUrl);
        await supabase.from('weekly_email_log').upsert({
          lead_id: lead.id, week_ending: weekEnding, status: 'sent',
        }, { onConflict: 'lead_id,week_ending' });
        sent++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('send failed', lead.email, msg);
        await supabase.from('weekly_email_log').upsert({
          lead_id: lead.id, week_ending: weekEnding, status: 'failed', error: msg,
        }, { onConflict: 'lead_id,week_ending' });
        failed++;
      }
      // small pacing delay
      await new Promise((r) => setTimeout(r, 50));
    }

    return new Response(JSON.stringify({ ok: true, sent, failed, skipped, week_ending: weekEnding }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('weekly error', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
