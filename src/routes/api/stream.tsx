import { createFileRoute } from "@tanstack/react-router"
import "@tanstack/react-start"
import { getSsid } from "#/lib/broker.server.ts"

export const Route = createFileRoute("/api/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const activeIdParam = url.searchParams.get("activeId");
        const activeId = activeIdParam ? parseInt(activeIdParam, 10) : 76;

        let ssid: string;
        try {
          ssid = await getSsid();
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            let isClosed = false;
            let ws: WebSocket | null = null;
            let pollInterval: ReturnType<typeof setInterval> | null = null;
            let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

            const sendEvent = (event: string, data: unknown) => {
              if (isClosed) return;
              try {
                controller.enqueue(
                  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
                );
              } catch {
                cleanup();
              }
            };

            const cleanup = () => {
              if (isClosed) return;
              isClosed = true;
              if (pollInterval) clearInterval(pollInterval);
              if (keepAliveInterval) clearInterval(keepAliveInterval);
              if (ws) {
                try {
                  ws.close();
                } catch {
                  // ignore
                }
              }
              try {
                controller.close();
              } catch {
                // ignore
              }
            };

            try {
              ws = new WebSocket("wss://ws.trade.optgobroker.com/echo/websocket");

              ws.addEventListener("open", () => {
                if (isClosed || !ws) return;
                ws.send(JSON.stringify({ name: "ssid", msg: ssid }));
              });

              ws.addEventListener("message", (ev) => {
                if (isClosed) return;
                let msg: { name?: string; msg?: unknown; request_id?: string };
                try {
                  msg = JSON.parse(ev.data as string);
                } catch {
                  return;
                }

                if (msg.name === "timeSync" && typeof msg.msg === "number") {
                  sendEvent("timeSync", { serverTime: msg.msg, clientTimestamp: Date.now() });
                }

                if (msg.name === "profile") {
                  if (msg.msg === false) {
                    sendEvent("error", { message: "Sessão inválida" });
                    cleanup();
                    return;
                  }
                  // Start high frequency broker 1M candles feed (every 500ms)
                  let reqCounter = 0;
                  const requestCandles = () => {
                    if (isClosed || !ws || ws.readyState !== WebSocket.OPEN) return;
                    reqCounter++;
                    ws.send(
                      JSON.stringify({
                        name: "sendMessage",
                        request_id: `stream_${reqCounter}`,
                        msg: {
                          name: "get-candles",
                          version: "2.0",
                          body: { active_id: activeId, size: 60, duration: 60 },
                        },
                      })
                    );
                  };

                  requestCandles();
                  pollInterval = setInterval(requestCandles, 500);
                }

                if (msg.request_id && msg.request_id.startsWith("stream_")) {
                  const data = msg.msg as { candles?: unknown[] } | unknown[] | undefined;
                  const rawCandles = Array.isArray(data) ? data : data?.candles;
                  if (Array.isArray(rawCandles) && rawCandles.length > 0) {
                    const last = rawCandles[rawCandles.length - 1] as {
                      from: number;
                      open: number;
                      max: number;
                      min: number;
                      close: number;
                    };
                    sendEvent("candle", {
                      time: last.from,
                      open: Number(last.open ?? 0),
                      high: Number(last.max ?? last.open ?? 0),
                      low: Number(last.min ?? last.open ?? 0),
                      close: Number(last.close ?? 0),
                      activeId,
                      allCount: rawCandles.length,
                    });
                  }
                }
              });

              ws.addEventListener("error", () => {
                cleanup();
              });

              ws.addEventListener("close", () => {
                cleanup();
              });

              // Heartbeat comment every 15s to keep SSE connection alive
              keepAliveInterval = setInterval(() => {
                if (isClosed) return;
                try {
                  controller.enqueue(encoder.encode(": keep-alive\n\n"));
                } catch {
                  cleanup();
                }
              }, 15000);

              request.signal.addEventListener("abort", () => {
                cleanup();
              });
            } catch {
              cleanup();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
})
