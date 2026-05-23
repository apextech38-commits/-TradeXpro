import { useRef, useEffect } from "react";
import { SmartChart, setSmartChartsPublicPath } from "@deriv/deriv-charts";
import "@deriv/deriv-charts/dist/smartcharts.css";
import { DERIV_APP_ID } from "@/context/AuthContext";

const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;

setSmartChartsPublicPath(import.meta.env.BASE_URL + "smartcharts-chunks/");

type ApiCb = (d: Record<string, unknown>) => void;

class DerivWSManager {
  private ws: WebSocket | null = null;
  private rid = 1;
  private once = new Map<number, ApiCb>();
  private byCb = new Map<ApiCb, { subId: string | null; rid: number }>();
  private byId = new Map<string, ApiCb>();
  private buf: string[] = [];
  private dead = false;

  constructor() {
    this.open();
  }

  private open() {
    if (this.dead) return;
    const ws = new WebSocket(WS_URL);
    this.ws = ws;

    ws.onopen = () => {
      this.buf.forEach(m => ws.send(m));
      this.buf = [];
    };

    ws.onmessage = (e) => {
      if (this.dead) return;
      let d: Record<string, unknown>;
      try { d = JSON.parse(e.data as string); } catch { return; }

      const rid = d.req_id as number | undefined;
      const sid = (d.subscription as { id: string } | undefined)?.id;

      if (sid) {
        if (!this.byId.has(sid)) {
          for (const [cb, info] of this.byCb) {
            if (info.rid === rid) {
              info.subId = sid;
              this.byId.set(sid, cb);
              cb(d);
              break;
            }
          }
        } else {
          this.byId.get(sid)!(d);
        }
        return;
      }

      if (rid && this.once.has(rid)) {
        this.once.get(rid)!(d);
        this.once.delete(rid);
      }
    };

    ws.onclose = () => { if (!this.dead) setTimeout(() => this.open(), 3000); };
    ws.onerror = () => {};
  }

  private tx(msg: object) {
    const s = JSON.stringify(msg);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(s);
    } else {
      this.buf.push(s);
    }
  }

  requestAPI = (req: Record<string, unknown>): Promise<Record<string, unknown>> =>
    new Promise(res => {
      const id = this.rid++;
      this.once.set(id, res as ApiCb);
      this.tx({ ...req, req_id: id });
    });

  requestSubscribe = (req: Record<string, unknown>, cb: ApiCb) => {
    const id = this.rid++;
    this.byCb.set(cb, { subId: null, rid: id });
    this.tx({ ...req, req_id: id, subscribe: 1 });
  };

  requestForget = (_req: Record<string, unknown>, cb: ApiCb) => {
    const info = this.byCb.get(cb);
    if (info?.subId) {
      this.tx({ forget: info.subId });
      this.byId.delete(info.subId);
    }
    this.byCb.delete(cb);
  };

  destroy() {
    this.dead = true;
    if (this.ws) { this.ws.onclose = null; this.ws.close(); }
  }
}

interface Props {
  symbol: string;
  height?: number | string;
  isMobile?: boolean;
}

export default function DerivSmartChart({ symbol, height = "100%", isMobile = true }: Props) {
  const mgr = useRef<DerivWSManager | null>(null);
  if (!mgr.current) mgr.current = new DerivWSManager();

  useEffect(() => {
    return () => {
      mgr.current?.destroy();
      mgr.current = null;
    };
  }, []);

  const m = mgr.current;

  return (
    <div style={{ height, width: "100%", overflow: "hidden" }}>
      <SmartChart
        id="tradex-sc"
        symbol={symbol}
        granularity={0}
        chartType="mountain"
        isMobile={isMobile}
        isConnectionOpened={true}
        enableRouting={false}
        requestAPI={m.requestAPI}
        requestSubscribe={m.requestSubscribe}
        requestForget={m.requestForget}
      />
    </div>
  );
}
