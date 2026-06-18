import { getPublicWsUrl } from '../config/urls';

type MessageHandler = (data: Record<string, unknown>) => void;
type ConnectionStateHandler = (connected: boolean) => void;
type ReconnectExhaustedHandler = () => void;

interface PendingRequest {
  resolve: (data: Record<string, unknown>) => void;
  reject: (error: Error) => void;
}

export class DerivWS {
  private ws: WebSocket | null = null;
  private reqIdCounter = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  public subscriptionHandlers = new Map<string, MessageHandler>();
  private globalHandlers: MessageHandler[] = [];
  private connectionStateHandlers: ConnectionStateHandler[] = [];
  private reconnectExhaustedHandlers: ReconnectExhaustedHandler[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  public url: string;
  private isConnecting = false;

  private tradeQueue: string[] = [];
  public wsReadyPromise: Promise<void> = Promise.resolve();
  private wsReadyResolve: () => void = () => {};

  constructor(url?: string) {
    this.url = url ?? getPublicWsUrl();
  }

  private makeReadyPending() {
    this.wsReadyPromise = new Promise((resolve) => {
      this.wsReadyResolve = resolve;
    });
  }

  private resolveReady() {
    this.wsReadyResolve();
    // Keep it resolved
    this.wsReadyPromise = Promise.resolve();
  }

  onConnectionStateChange(handler: ConnectionStateHandler): () => void {
    this.connectionStateHandlers.push(handler);
    return () => {
      this.connectionStateHandlers = this.connectionStateHandlers.filter((h) => h !== handler);
    };
  }

  onReconnectExhausted(handler: ReconnectExhaustedHandler): () => void {
    this.reconnectExhaustedHandlers.push(handler);
    return () => {
      this.reconnectExhaustedHandlers = this.reconnectExhaustedHandlers.filter((h) => h !== handler);
    };
  }

  private notifyConnectionState(connected: boolean): void {
    for (const handler of this.connectionStateHandlers) {
      handler(connected);
    }
  }

  updateUrl(url: string): void {
    this.url = url;
  }

  async swapSocketAuthenticated(newUrl: string): Promise<void> {
    console.log(`[SWAP LOG] Swapping connection framework target to authorized domain route.`);
    this.makeReadyPending();
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const ids = Array.from(this.subscriptionHandlers.keys());
        if (ids.length) {
          ids.forEach(id => this.ws?.send(JSON.stringify({ forget: id, req_id: ++this.reqIdCounter })));
        }
      } catch (e) { console.error(e); }
    }

    await new Promise(r => setTimeout(r, 100));
    this.subscriptionHandlers.clear();

    this.stopPing();
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
      this.ws = null;
    }

    this.updateUrl(newUrl);
    await this.connect();
  }

  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.resolveReady();
      return Promise.resolve();
    }
    if (this.isConnecting) {
      return this.wsReadyPromise;
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
      } catch (err) {
        this.isConnecting = false;
        this.resolveReady();
        reject(err);
        return;
      }

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startPing();
        this.notifyConnectionState(true);
        this.resolveReady();
        resolve();

        while (this.tradeQueue.length) {
          const msg = this.tradeQueue.shift();
          if (msg) this.ws?.send(msg);
        }
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
        this.resolveReady();
        reject(new Error('WebSocket connection error'));
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.stopPing();
        this.notifyConnectionState(false);
        this.resolveReady();
        this.attemptReconnect();
      };
    });
  }

  async send<T = Record<string, unknown>>(payload: Record<string, unknown>): Promise<T> {
    if (this.ws?.readyState !== WebSocket.OPEN && (payload.buy || payload.proposal)) {
      await this.wsReadyPromise;
    }

    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        if (payload.buy || payload.proposal) {
          this.tradeQueue.push(JSON.stringify({ ...payload, req_id: ++this.reqIdCounter }));
          return;
        }
        reject(new Error('WebSocket is not connected'));
        return;
      }

      const reqId = ++this.reqIdCounter;
      const message = { ...payload, req_id: reqId };

      this.pendingRequests.set(reqId, {
        resolve: resolve as (data: Record<string, unknown>) => void,
        reject,
      });

      this.ws.send(JSON.stringify(message));
    });
  }

  async subscribe(
    payload: Record<string, unknown>,
    handler: MessageHandler
  ): Promise<{ subscriptionId: string | null; unsubscribe: () => void }> {
    
    // Check if we are already listening to this asset symbol stream to stop duplicate subscribe floods
    if (payload.ticks && typeof payload.ticks === 'string') {
      const activeSymbol = payload.ticks;
      if (this.subscriptionHandlers.has(activeSymbol)) {
        return resolve({
          subscriptionId: activeSymbol,
          unsubscribe: () => {}
        });
      }
    }

    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }

      const reqId = ++this.reqIdCounter;
      const message = { ...payload, subscribe: 1, req_id: reqId };

      this.pendingRequests.set(reqId, {
        resolve: (data) => {
          const subscriptionId = this.extractSubscriptionId(data) || (payload.ticks as string) || null;
          if (subscriptionId) {
            this.subscriptionHandlers.set(subscriptionId, handler);
          }
          handler(data);
          resolve({
            subscriptionId,
            unsubscribe: () => {
              if (subscriptionId) {
                this.subscriptionHandlers.delete(subscriptionId);
                this.send({ forget: subscriptionId }).catch(() => {});
              }
            },
          });
        },
        reject,
      });

      this.ws.send(JSON.stringify(message));
    });
  }

  onMessage(handler: MessageHandler): () => void {
    this.globalHandlers.push(handler);
    return () => {
      this.globalHandlers = this.globalHandlers.filter((h) => h !== handler);
    };
  }

  disconnect(): void {
    this.stopPing();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.pendingRequests.clear();
    this.subscriptionHandlers.clear();
    this.resolveReady();
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private handleMessage(data: Record<string, unknown>): void {
    for (const handler of this.globalHandlers) {
      handler(data);
    }

    const reqId = data.req_id as number | undefined;

    if (data.error) {
      if (reqId && this.pendingRequests.has(reqId)) {
        const pending = this.pendingRequests.get(reqId)!;
        this.pendingRequests.delete(reqId);
        pending.reject(new Error((data.error as Record<string, string>).message));
      }
      return;
    }

    const subId = this.extractSubscriptionId(data);
    if (subId && this.subscriptionHandlers.has(subId)) {
      this.subscriptionHandlers.get(subId)!(data);
    }
    
    // Fallback search checking using specific asset symbol keys
    if (data.tick && typeof data.tick === 'object' && !subId) {
      const sym = (data.tick as Record<string, string>).symbol;
      if (sym && this.subscriptionHandlers.has(sym)) {
        this.subscriptionHandlers.get(sym)!(data);
      }
    }

    if (reqId && this.pendingRequests.has(reqId)) {
      const pending = this.pendingRequests.get(reqId)!;
      this.pendingRequests.delete(reqId);
      pending.resolve(data);
    }
  }

  private extractSubscriptionId(data: Record<string, unknown>): string | null {
    if (data.subscription && typeof data.subscription === 'object') {
      return (data.subscription as Record<string, string>).id ?? null;
    }
    if (data.tick && typeof data.tick === 'object') {
      return (data.tick as Record<string, string>).id ?? null;
    }
    return null;
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ ping: 1 }));
      }
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      for (const handler of this.reconnectExhaustedHandlers) handler();
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }
}
