/**
 * Bitcoin Cycle Dashboard — Embeddable Widget
 * Usage:
 *   <div id="btc-cycle-widget"></div>
 *   <script src="https://orbit-gauge.lovable.app/widget.js"></script>
 *
 * Optional: add data-target="my-id" on the script tag to render into a different element.
 */
(function () {
  var API = 'https://xcnvivproparhsvtlqqm.supabase.co/functions/v1/public-api/latest';
  var SCRIPT = document.currentScript;
  var TARGET_ID = (SCRIPT && SCRIPT.getAttribute('data-target')) || 'btc-cycle-widget';

  function phaseColor(phase) {
    var map = {
      'Deep Value': '#2563eb',
      'Accumulation': '#16a34a',
      'Bull Market': '#eab308',
      'Overheated': '#f97316',
      'Cycle Top Risk': '#dc2626',
    };
    return map[phase] || '#eab308';
  }

  function render(el, data) {
    if (!data) {
      el.innerHTML = '<div style="font-family:system-ui;color:#888;padding:16px">No data available.</div>';
      return;
    }
    var maxScore = data.mvrv_score != null ? 20 : 16;
    var score = data.cycle_total_score || 0;
    var pct = Math.round((score / maxScore) * 100);
    var color = phaseColor(data.cycle_phase);
    var price = data.btc_close_usd != null
      ? '$' + Number(data.btc_close_usd).toLocaleString(undefined, { maximumFractionDigits: 0 })
      : '—';

    el.innerHTML =
      '<div style="font-family:system-ui,-apple-system,sans-serif;background:#0f1115;color:#fff;border:1px solid #2a2d35;border-radius:12px;padding:20px;max-width:360px">' +
        '<div style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#8a8f99;margin-bottom:8px">Bitcoin Market Signal</div>' +
        '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px">' +
          '<div style="font-size:32px;font-weight:700;color:' + color + '">' + score + '<span style="font-size:16px;color:#8a8f99;font-weight:400">/' + maxScore + '</span></div>' +
          '<div style="font-size:14px;color:#cfd3dc">' + price + '</div>' +
        '</div>' +
        '<div style="height:6px;background:#1a1d24;border-radius:3px;overflow:hidden;margin-bottom:10px">' +
          '<div style="height:100%;width:' + pct + '%;background:' + color + '"></div>' +
        '</div>' +
        '<div style="font-size:14px;font-weight:600;color:' + color + ';margin-bottom:4px">' + (data.cycle_phase || '—') + '</div>' +
        '<div style="font-size:12px;color:#8a8f99;line-height:1.4">' + (data.strategy_signal || '') + '</div>' +
        '<a href="https://orbit-gauge.lovable.app" target="_blank" rel="noopener" style="display:block;margin-top:12px;font-size:11px;color:#6b7280;text-decoration:none">Powered by MCG Cycle Dashboard →</a>' +
      '</div>';
  }

  function mount() {
    var el = document.getElementById(TARGET_ID);
    if (!el) return;
    el.innerHTML = '<div style="font-family:system-ui;color:#888;padding:16px">Loading…</div>';
    fetch(API)
      .then(function (r) { return r.json(); })
      .then(function (data) { render(el, data); })
      .catch(function () {
        el.innerHTML = '<div style="font-family:system-ui;color:#c33;padding:16px">Failed to load.</div>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
