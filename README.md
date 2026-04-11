# @distlang/client

JavaScript client for Distlang public APIs.

This package is stateless by design:

- pass access tokens explicitly per request
- configure auth and store base URLs explicitly when needed
- use the global `fetch` by default, or inject your own

## Install

```bash
npm install @distlang/client
```

## Quick Start

```js
import { createDistlangClient } from "@distlang/client";

const client = createDistlangClient();

const identity = await client.auth.whoAmI(process.env.DISTLANG_ACCESS_TOKEN);
const buckets = await client.objectdb.buckets.list(process.env.DISTLANG_ACCESS_TOKEN);

console.log(identity.user.email);
console.log(buckets.buckets);
```

## Configuration

```js
import { createDistlangClient } from "@distlang/client";

const client = createDistlangClient({
  authBaseURL: "https://auth.distlang.com",
  storeBaseURL: "https://api.distlang.com",
  fetch,
});
```

Defaults:

- `authBaseURL`: `https://auth.distlang.com`
- `storeBaseURL`: `https://api.distlang.com`
- `fetch`: global `fetch`

## API Surface

- `createDistlangClient(config)`
- `createAuthClient(config)`
- `createObjectDBClient(config)`
- `createMetricsClient(config)`
- `createDeploymentsClient(config)`

## Examples

- `examples/metrics-recorder.js`: higher-level app instrumentation with `client.metrics.createRecorder(...)`
- `examples/metrics-low-level.js`: direct low-level metrics query client usage

### Auth

```js
const auth = client.auth;

await auth.exchangeCLIAuthCode({
  code,
  state,
  codeVerifier,
  redirectURI,
});

await auth.refresh(refreshToken);
await auth.whoAmI(accessToken);
await auth.logout(refreshToken);
await auth.serviceToken(accessToken, { service: "objectdb", rotate: false });
await auth.serviceTokenWhoAmI(serviceToken);
```

### ObjectDB

```js
const objectdb = client.objectdb;

await objectdb.status(accessToken);
await objectdb.buckets.list(accessToken);
await objectdb.buckets.create(accessToken, "demo");
await objectdb.keys.list(accessToken, "demo", { prefix: "users/" });
await objectdb.put(accessToken, "demo", "profile.json", { ok: true });
await objectdb.get(accessToken, "demo", "profile.json");
await objectdb.head(accessToken, "demo", "profile.json");
await objectdb.delete(accessToken, "demo", "profile.json");
```

### Metrics

```js
const metrics = client.metrics;

await metrics.query(accessToken, "up");
await metrics.queryRange(accessToken, "up", {
  start: "2026-04-10T00:00:00Z",
  end: "2026-04-10T01:00:00Z",
  step: "60s",
});

await metrics.metricSets.ensure(accessToken, "simpleapp-metrics", {
  requestCount: {
    kind: "counter",
    description: "Requests served",
    unit: "requests",
    labels: ["route", "status"],
  },
});

await metrics.metricSets.appendRows(accessToken, "simpleapp-metrics", [
  {
    windowStart: new Date().toISOString(),
    metric: "requestCount",
    kind: "counter",
    count: 1,
    sum: 1,
    labels: { route: "/", status: "200" },
  },
]);
```

Higher-level app instrumentation:

```js
const metrics = client.metrics.createRecorder({
  accessToken,
  metricSet: "app-echo-metrics",
  definitions: {
    echoReqCount: {
      kind: "counter",
      description: "Number of echo requests handled",
      unit: "requests",
      labels: ["route", "method", "status"],
    },
    latencyMs: {
      kind: "histogram",
      description: "Echo request latency",
      unit: "ms",
      labels: ["route", "method", "status"],
    },
  },
});

metrics.echoReqCount.inc({ route: "/echo/:text", method: "GET", status: "200" });
metrics.latencyMs.observe(42, { route: "/echo/:text", method: "GET", status: "200" });

await metrics.flush();
```

The recorder buffers writes in memory, ensures the metric set lazily on first use, and flushes all buffered rows when you call `flush()`.

### Deployments

```js
const deployments = client.deployments;

await deployments.list(accessToken);
await deployments.create(accessToken, request);
await deployments.delete(accessToken, deploymentID);
```
