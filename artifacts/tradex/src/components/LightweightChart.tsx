import { useEffect, useRef } from "react";
import {
  createChart, ColorType, AreaSeries, LineStyle,
} from "lightweight-charts";
import type {
  IChartApi, ISeriesApi, UTCTimestamp, IPriceLine,
} from "lightweight-charts";
import { DERIV_APP_ID } from "@/context/AuthContext";

const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;

/* ── Design tokens (traderkit.pro dark chart palette) ─────────────────── */
const BG        = "#0f172a";
const LINE      = "#2962ff";
const FILL_TOP  = "rgba(41,98,255,0.28)";
const FILL_BOT  = "rgba(41,98,255,0)";
const AXIS_TEXT = "#94a3b8";
const GRID      = "rgba(148,163,184,0.07)";
const BORDER    = "rgba(148,163,184,0.12)";
const CROSS     = "rgba(148,163,184,0.35)";
const LABEL_BG  = "#2962ff";

interface Props {
  symbol: string;
  /** Enables dashed price line + trade-window overlay */
  tradingMode?: boolean;
  /** Fires on every incoming price (history last price + live ticks) */
  onPriceUpdate?: (price: number) => void;
}

export default function LightweightChart({ symbol, tradingMode = false, onPriceUpdate }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<IChartApi | null>(null);
  const seriesRef     = useRef<ISeriesApi<"Area"> | null>(null);
  const wsRef         = useRef<WebSocket | null>(null);
  const roRef         = useRef<ResizeObserver | null>(null);
  const mountRef      = useRef(true);
  const priceLineRef  = useRef<IPriceLine | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    mountRef.current = true;
    const el = containerRef.current;

    /* ── Chart ──────────────────────────────────────────────────────────── */
    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: BG },
        textColor:  AXIS_TEXT,
        fontSize:   11,
        fontFamily: "'IBM Plex Sans','Inter',system-ui,sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: GRID, style: LineStyle.Solid },
        horzLines: { color: GRID, style: LineStyle.Solid },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: CROSS, width: 1, style: LineStyle.Dashed,
          labelBackgroundColor: LABEL_BG,
        },
        horzLine: {
          color: CROSS, width: 1, style: LineStyle.Dashed,
          labelBackgroundColor: LABEL_BG,
        },
      },
      rightPriceScale: {
        borderColor:  BORDER,
        scaleMargins: { top: 0.1, bottom: 0.08 },
      },
      timeScale: {
        borderColor:    BORDER,
        timeVisible:    true,
        secondsVisible: true,
        rightOffset:    tradingMode ? 6 : 3,
        barSpacing:     tradingMode ? 4 : 3,
        fixLeftEdge:    false,
        lockVisibleTimeRangeOnResize: true,
      },
      handleScroll: !tradingMode,
      handleScale:  !tradingMode,
      width:  el.clientWidth,
      height: el.clientHeight || 300,
    });
    chartRef.current = chart;

    /* ── Area series (same for both modes — gradient fill under the line) ─ */
    const area = chart.addSeries(AreaSeries, {
      lineColor:   LINE,
      topColor:    FILL_TOP,
      bottomColor: FILL_BOT,
      lineWidth:   2,
      crosshairMarkerVisible:         true,
      crosshairMarkerRadius:          5,
      crosshairMarkerBackgroundColor: LINE,
      crosshairMarkerBorderColor:     "#ffffff",
      crosshairMarkerBorderWidth:     2,
      lastValueVisible:  true,
      priceLineVisible:  false,
    });
    seriesRef.current = area;

    /* ── Dashed live-price line (trading mode only) ─────────────────────── */
    if (tradingMode) {
      priceLineRef.current = area.createPriceLine({
        price:            0,
        color:            LINE,
        lineWidth:        1,
        lineStyle:        LineStyle.Dashed,
        axisLabelVisible: false,
        title:            "",
      });
    }

    /* ── ResizeObserver ─────────────────────────────────────────────────── */
    const ro = new ResizeObserver(() => {
      if (!el || !chartRef.current) return;
      chartRef.current.applyOptions({
        width:  el.clientWidth,
        height: el.clientHeight,
      });
    });
    ro.observe(el);
    roRef.current = ro;

    /* ── WebSocket (DO NOT MODIFY — WS logic is intentionally untouched) ── */
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountRef.current) return;
      ws.send(JSON.stringify({
        ticks_history: symbol,
        count:         500,
        end:           "latest",
        style:         "ticks",
        subscribe:     1,
      }));
    };

    ws.onmessage = (evt) => {
      if (!mountRef.current) return;
      try {
        const msg = JSON.parse(evt.data as string);
        if (msg.error) return;

        if (msg.msg_type === "history") {
          const { times, prices } = msg.history as { times: number[]; prices: number[] };
          const pts = times.map((t, i) => ({
            time:  t as UTCTimestamp,
            value: prices[i],
          }));
          if (seriesRef.current && pts.length > 0) {
            seriesRef.current.setData(pts);
            chartRef.current?.timeScale().fitContent();
            if (tradingMode && priceLineRef.current && prices.length > 0) {
              priceLineRef.current.applyOptions({ price: prices[prices.length - 1] });
            }
            if (prices.length > 0) onPriceUpdate?.(prices[prices.length - 1]);
          }
        }

        if (msg.msg_type === "tick") {
          const { epoch, quote } = msg.tick as { epoch: number; quote: number };
          seriesRef.current?.update({ time: epoch as UTCTimestamp, value: quote });
          if (tradingMode && priceLineRef.current) {
            priceLineRef.current.applyOptions({ price: quote });
          }
          onPriceUpdate?.(quote);
        }
      } catch (_) {}
    };

    ws.onerror = () => {};
    ws.onclose = () => {};

    return () => {
      mountRef.current = false;
      ro.disconnect();
      ws.onclose = null;
      ws.close();
      chart.remove();
      chartRef.current     = null;
      seriesRef.current    = null;
      priceLineRef.current = null;
    };
  }, [symbol, tradingMode]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>

      {/* lightweight-charts canvas */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* ── Trading-mode overlays ──────────────────────────────────────── */}
      {tradingMode && (
        <>
          {/* Trade-window: rightmost ~22% with dashed left border */}
          <div
            style={{
              position:        "absolute",
              top:             0,
              right:           0,
              width:           "22%",
              bottom:          24,
              backgroundColor: "rgba(41,98,255,0.05)",
              borderLeft:      "1.5px dashed rgba(41,98,255,0.45)",
              pointerEvents:   "none",
            }}
          >
            <span style={{
              position: "absolute", top: 10, left: 7,
              fontSize: "9px", fontWeight: 700, letterSpacing: "0.07em",
              textTransform: "uppercase", color: "rgba(41,98,255,0.65)",
              userSelect: "none",
            }}>
              Entry
            </span>

            {/* Pulsing dot on the entry line */}
            <span style={{
              position: "absolute", top: "50%", left: -5,
              transform: "translateY(-50%)",
              width: 8, height: 8, borderRadius: "50%",
              backgroundColor: LINE,
              boxShadow: "0 0 0 3px rgba(41,98,255,0.25)",
              animation: "tradex-pulse 2s ease-in-out infinite",
            }} />

            <span style={{
              position: "absolute", bottom: 8, right: 7,
              fontSize: "9px", fontWeight: 700, letterSpacing: "0.07em",
              textTransform: "uppercase", color: "rgba(41,98,255,0.4)",
              userSelect: "none",
            }}>
              Exit
            </span>
          </div>

          <style>{`
            @keyframes tradex-pulse {
              0%, 100% { box-shadow: 0 0 0 3px rgba(41,98,255,0.25); }
              50%       { box-shadow: 0 0 0 7px rgba(41,98,255,0.08); }
            }
          `}</style>
        </>
      )}
    </div>
  );
}
