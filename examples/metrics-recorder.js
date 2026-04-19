import { createDistlangClient } from "@distlang/client";

const client = createDistlangClient({
  storeBaseURL: process.env.DISTLANG_STORE_BASE_URL,
});

const metrics = client.metrics.createRecorder({
  accessToken: process.env.DISTLANG_ACCESS_TOKEN,
  metricSet: "app-echo-metrics",
  definitions: {
    echoReqCount: "counter",
    echoLatencyMs: "histogram",
  },
});

async function handleEchoRequest(work) {
  const startedAt = Date.now();
  try {
    await work();
    metrics.echoReqCount.inc();
  } finally {
    metrics.echoLatencyMs.observe(Date.now() - startedAt);
    await metrics.flush();
  }
}

await handleEchoRequest(async () => {
  console.log("echo request handled");
});
