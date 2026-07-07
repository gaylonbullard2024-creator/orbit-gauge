import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * BTC/USD TradingView chart with click-to-load behavior.
 * The TradingView widget is not loaded until the user explicitly clicks
 * the placeholder, avoiding heavy third-party scripts on initial page load.
 */
export function TradingViewChart() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = '';

    // Container the widget script targets
    const container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    container.style.height = '100%';
    container.style.width = '100%';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = 'calc(100% - 28px)';
    widgetDiv.style.width = '100%';

    const copyright = document.createElement('div');
    copyright.className = 'tradingview-widget-copyright';
    copyright.style.height = '28px';
    copyright.style.lineHeight = '28px';
    copyright.style.fontSize = '11px';
    copyright.style.textAlign = 'right';
    copyright.style.paddingRight = '8px';
    copyright.innerHTML =
      '<a href="https://www.tradingview.com/symbols/BTCUSD/" rel="noopener nofollow" target="_blank" style="color:#60a5fa;text-decoration:none;">Track BTC/USD</a><span style="color:#94a3b8;"> on TradingView</span>';

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: 'BITSTAMP:BTCUSD',
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: 'rgba(15, 15, 18, 1)',
      gridColor: 'rgba(255, 255, 255, 0.06)',
      allow_symbol_change: true,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_volume: false,
      withdateranges: true,
      save_image: true,
      details: true,
      calendar: false,
      hotlist: false,
      studies: ['STD;MA%1Ribbon'],
      support_host: 'https://www.tradingview.com',
    });

    container.appendChild(widgetDiv);
    container.appendChild(copyright);
    container.appendChild(script);
    host.appendChild(container);

    return () => {
      host.innerHTML = '';
    };
  }, [loaded]);

  return (
    <Card className="border-border/50 bg-card/80 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <span className="text-lg">📈</span>
          BTC / USD — Live Market Chart
          <span className="ml-auto text-[10px] font-normal text-muted-foreground/60 uppercase tracking-wider">
            Real-time · TradingView
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative w-full h-[640px] sm:h-[720px] lg:h-[820px] overflow-hidden">
          {!loaded ? (
            <button
              type="button"
              onClick={() => setLoaded(true)}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-card/90 hover:bg-card/70 transition-colors cursor-pointer group"
            >
              <div className="rounded-full bg-primary/10 p-4 group-hover:bg-primary/20 transition-colors">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary"
                >
                  <path d="M3 3v18h18" />
                  <path d="M7 16l4-4 4 4 6-7" />
                  <circle cx="21" cy="9" r="1.5" fill="currentColor" />
                </svg>
              </div>
              <div className="text-center space-y-1">
                <p className="text-base font-medium text-foreground">Load BTC/USD Trading Chart</p>
                <p className="text-sm text-muted-foreground">
                  Click to load the live TradingView widget
                </p>
              </div>
              <Button size="sm" className="pointer-events-none">
                Load Chart
              </Button>
            </button>
          ) : (
            <div ref={hostRef} className="absolute inset-0" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

