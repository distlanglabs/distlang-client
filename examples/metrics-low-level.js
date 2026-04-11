import { createMetricsClient } from "@distlang/client";

const metrics = createMetricsClient({
  storeBaseURL: process.env.DISTLANG_STORE_BASE_URL,
});

const accessToken = process.env.DISTLANG_ACCESS_TOKEN;

const response = await metrics.queryRange(accessToken, "up", {
  start: "2026-04-10T00:00:00Z",
  end: "2026-04-10T01:00:00Z",
  step: "60s",
});

console.log(JSON.stringify(response, null, 2));
