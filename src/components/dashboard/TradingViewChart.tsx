import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Real-time BTC/USD trading chart via TradingView embedded widget.
 */
export function TradingViewChart() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Clear any previous instance (React StrictMode / route changes)
    containerRef.current.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = 'calc(100% - 32px)';
    widgetDiv.style.width = '100%';

    const copyright = document.createElement('div');
    copyright.className = 'tradingview-widget-copyright';
    copyright.innerHTML =
      '<a href="https://www.tradingview.com/symbols/BTCUSD/" rel="noopener nofollow" target="_blank"><span class="blue-text">BTC/USD chart</span></a><span class="trademark"> by TradingView</span>';

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      allow_symbol_change: true,
      calendar: false,
      details: false,
      hide_side_toolbar: true,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_volume: false,
      hotlist: false,
      interval: 'D',
      locale: 'en',
      save_image: true,
      style: '1',
      symbol: 'BITSTAMP:BTCUSD',
      theme: 'dark',
      timezone: 'Etc/UTC',
      backgroundColor: 'rgba(15, 15, 18, 1)',
      gridColor: 'rgba(255, 255, 255, 0.06)',
      watchlist: [],
      withdateranges: true,
      compareSymbols: [],
      studies: [],
      autosize: true,
    });

    containerRef.current.appendChild(widgetDiv);
    containerRef.current.appendChild(copyright);
    containerRef.current.appendChild(script);
  }, []);

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <span className="text-lg">📈</span>
          BTC / USD — Real-Time Chart
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          ref={containerRef}
          className="tradingview-widget-container w-full h-[560px] sm:h-[640px] lg:h-[720px]"
        />

      </CardContent>
    </Card>
  );
}
