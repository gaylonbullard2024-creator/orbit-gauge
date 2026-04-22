import { useState } from 'react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const API_BASE = `${SUPABASE_URL}/functions/v1/public-api`;
const SITE = typeof window !== 'undefined' ? window.location.origin : 'https://orbit-gauge.lovable.app';

const ENDPOINTS: { method: string; path: string; desc: string }[] = [
  { method: 'GET', path: '/', desc: 'API index — lists all endpoints' },
  { method: 'GET', path: '/latest', desc: 'Latest dashboard snapshot (score, phase, all indicators)' },
  { method: 'GET', path: '/snapshots?days=365', desc: 'Historical dashboard snapshots' },
  { method: 'GET', path: '/btc-price', desc: 'BTC daily close prices (full history if days omitted)' },
  { method: 'GET', path: '/fear-greed?days=365', desc: 'Fear & Greed index history' },
  { method: 'GET', path: '/macro?days=365', desc: 'Macro (DXY) history' },
  { method: 'GET', path: '/weekly-report', desc: 'Latest weekly commentary' },
  { method: 'GET', path: '/all?days=365', desc: 'Everything in one response' },
];

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative">
      <pre className="rounded-lg border border-border bg-muted/30 p-4 text-xs overflow-x-auto font-mono text-foreground/90">
        <code>{code}</code>
      </pre>
      <Button
        size="sm"
        variant="ghost"
        onClick={copy}
        className="absolute right-2 top-2 h-7 w-7 p-0"
        aria-label="Copy"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export default function ApiDocs() {
  const widgetSnippet = `<div id="btc-cycle-widget"></div>
<script src="${SITE}/widget.js"></script>`;

  const fetchSnippet = `fetch('${API_BASE}/latest')
  .then(r => r.json())
  .then(data => {
    console.log('Cycle phase:', data.cycle_phase);
    console.log('Score:', data.cycle_total_score, '/ 20');
    console.log('BTC price:', data.btc_close_usd);
  });`;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-10">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Public API & Embeddable Widget</h1>
          <p className="mt-2 text-muted-foreground">
            Use the Bitcoin Cycle Dashboard data on your own site. Free, no key required, JSON over HTTPS, CORS enabled.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Base URL</h2>
          <CodeBlock code={API_BASE} />
          <p className="text-sm text-muted-foreground">
            All endpoints return JSON. Cached for 5 minutes at the edge. Data refreshes daily ~6 AM ET.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Endpoints</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3 w-16">Method</th>
                  <th className="text-left p-3">Path</th>
                  <th className="text-left p-3">Description</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map((e) => (
                  <tr key={e.path} className="border-t border-border">
                    <td className="p-3 font-mono text-primary">{e.method}</td>
                    <td className="p-3 font-mono">{e.path}</td>
                    <td className="p-3 text-muted-foreground">{e.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Quick start — JavaScript</h2>
          <CodeBlock code={fetchSnippet} />
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Embeddable widget</h2>
          <p className="text-sm text-muted-foreground">
            Drop this snippet anywhere on your site. The widget renders the latest score, phase, BTC price, and strategy signal.
          </p>
          <CodeBlock code={widgetSnippet} />
          <div className="rounded-lg border border-border bg-muted/20 p-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Live preview</p>
            <div id="btc-cycle-widget-preview-host">
              <WidgetPreview />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Response shape — /latest</h2>
          <CodeBlock
            code={`{
  "date": "2025-04-21",
  "btc_close_usd": 87234.12,
  "cycle_total_score": 11,
  "cycle_phase": "Bull Market",
  "strategy_signal": "Hold core BTC allocation...",
  "fear_greed_value": 62,
  "fear_greed_score": 3,
  "mvrv_value": 2.4,
  "mvrv_score": 2,
  "ma_200w_value": 48210.5,
  "ma_200w_score": 2,
  "rainbow_band": "Growth",
  "rainbow_score": 2,
  "macro_value": 104.7,
  "macro_score": 2
}`}
          />
        </section>

        <section className="space-y-2 pb-12">
          <h2 className="text-xl font-semibold">Terms</h2>
          <p className="text-sm text-muted-foreground">
            Free for personal and commercial use. Attribution appreciated but not required. Not financial advice.
            Best-effort uptime — no SLA. Please cache responses on your side; the API is rate-limited per IP.
          </p>
        </section>
      </main>
    </div>
  );
}

function WidgetPreview() {
  return (
    <iframe
      title="Widget preview"
      srcDoc={`<!doctype html><html><body style="margin:0;background:transparent">
<div id="btc-cycle-widget"></div>
<script src="${SITE}/widget.js"></script>
</body></html>`}
      className="w-full h-[260px] border-0 bg-transparent"
    />
  );
}
