import { createDistlangClient } from "@distlang/client";

const client = createDistlangClient({
  storeBaseURL: process.env.DISTLANG_STORE_BASE_URL,
});

const metrics = client.metrics.createRecorder({
  accessToken: process.env.DISTLANG_ACCESS_TOKEN,
  metricSet: "app-echo-metrics",
  definitions: {
    echoReqCount: {
      kind: "counter",
      description: "Number of echo requests handled",
      unit: "requests",
      labels: ["route", "method", "status"],
    },
    echoLatencyMs: {
      kind: "histogram",
      description: "Latency for echo requests",
      unit: "ms",
      labels: ["route", "method", "status"],
    },
  },
});

async function handleEchoRequest(route, method, status, work) {
  const startedAt = Date.now();
  try {
    await work();
    metrics.echoReqCount.inc({ route, method, status });
  } finally {
    metrics.echoLatencyMs.observe(Date.now() - startedAt, { route, method, status });
    await metrics.flush();
  }
}

await handleEchoRequest("/echo/:text", "GET", "200", async () => {
  console.log("echo request handled");
});
