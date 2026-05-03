import { createClient } from 'jsr:@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function page(title: string, message: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;background:#0b0d12;color:#e5e7eb;font-family:-apple-system,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#11141b;border:1px solid #1f2430;border-radius:8px;padding:40px;max-width:480px;text-align:center}
h1{color:#fff;font-size:22px;margin:0 0 12px}p{color:#cbd1dc;line-height:1.6;margin:0 0 20px}
a{color:#f7931a;text-decoration:none;font-weight:600}.tag{font-size:11px;letter-spacing:2px;color:#f7931a;font-weight:600;margin-bottom:16px}</style>
</head><body><div class="card"><div class="tag">THE CRYPTO INVESTORS</div><h1>${title}</h1><p>${message}</p><a href="https://app.thecryptoinvestors.com">← Back to dashboard</a></div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return new Response(page('Invalid link', 'This unsubscribe link is missing a token.'), {
      status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const { data, error } = await supabase
    .from('leads')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('unsubscribe_token', token)
    .select('email')
    .maybeSingle();

  if (error || !data) {
    return new Response(page('Link not found', 'We could not find a subscription matching this link. It may have already been used.'), {
      status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return new Response(page('You\'re unsubscribed', `${data.email} will no longer receive the weekly Bitcoin report. You still have full access to the dashboard.`), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});
