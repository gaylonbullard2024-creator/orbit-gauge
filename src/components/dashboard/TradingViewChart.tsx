import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Real-time BTC/USD trading chart via TradingView embedded widget.
 * The TradingView script injects an <iframe> that fills the container it is
 * appended to, so we give that container an explicit pixel height and let the
 * outer card handle padding + overflow.
 */
export function TradingViewChart() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
  }, []);

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
          <div ref={hostRef} className="absolute inset-0" />
        </div>
      </CardContent>
    </Card>
  );
}
