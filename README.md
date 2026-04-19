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

## Overview

Distlang has two main public surfaces:

- `dash`: the browser UI for signing in, viewing dashboards, and managing your API token
- `@distlang/client`: the JavaScript package for calling Distlang APIs from Node, workers, and other apps

If you need a token for `@distlang/client`, sign in through `dash` and open the auth page. The dashboard lets you create, rotate, and revoke your API token for `api.distlang.com`.

Once issued, pass that token into this package. For app instrumentation, the higher-level metrics recorder is usually the simplest way to start:

```js
import { createDistlangClient } from "@distlang/client";

const client = createDistlangClient();

const metrics = client.metrics.createRecorder({
  accessToken: process.env.DISTLANG_ACCESS_TOKEN,
  metricSet: "app-echo-metrics",
  definitions: {
    requestCount: "counter",
    latencyMs: "histogram",
  },
});

metrics.requestCount.inc();
metrics.latencyMs.observe(42);

await metrics.flush();
```

The recorder buffers writes in memory and auto-flushes at most once per second by default. Call `await metrics.flush()` when you know the process, request, or worker may exit before the next scheduled flush.

Start with scalar metrics by default. Labeled metrics are best reserved for low-cardinality dimensions such as `status`, `result`, or `operation`. Avoid high-cardinality labels such as user IDs, request IDs, raw paths, or anything that can grow without bound.

Public docs:

- Store APIs: `https://api.distlang.com/docs`
- Auth APIs: `https://auth.distlang.com/docs`

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

If you already have a Worker binding or custom request transport, use the fetcher-backed constructor and keep the rest of the client API the same:

```js
import { createDistlangClientWithFetcher } from "@distlang/client";

const client = createDistlangClientWithFetcher(
  (request) => env.DISTLANG_STORE.fetch(request),
  {
    authBaseURL: "https://auth.distlang.com",
    storeBaseURL: "https://api.distlang.com",
  },
);
```

Defaults:

- `authBaseURL`: `https://auth.distlang.com`
- `storeBaseURL`: `https://api.distlang.com`
- `fetch`: global `fetch`

## API Surface

- `createDistlangClient(config)`
- `createDistlangClientWithFetcher(fetcher, config)`
- `createAuthClient(config)`
- `createObjectDBClient(config)`
- `createMetricsClient(config)`
- `createDeploymentsClient(config)`

## Examples

- `examples/metrics-recorder.js`: higher-level app instrumentation with `client.metrics.createRecorder(...)`
- `examples/metrics-low-level.js`: direct low-level metrics query client usage

## Release

This repo currently uses a manual release flow.

1. Update `package.json` to the next version.
2. Refresh the lockfile:

```bash
npm install --package-lock-only
```

3. Verify the package locally:

```bash
npm run release
```

4. Commit and push the release version:

```bash
git add package.json package-lock.json
git commit -m "release 0.1.4"
git push origin main
```

5. Publish to npm:

```bash
npm run publish
```

6. Create a GitHub release tag:

```bash
gh release create v0.1.4 --title "v0.1.4"
```

You can swap `0.1.4` for the version you are releasing.

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
    labels: [],
  },
});

await metrics.metricSets.appendRows(accessToken, "simpleapp-metrics", [
  {
    windowStart: new Date().toISOString(),
    metric: "requestCount",
    kind: "counter",
    count: 1,
    sum: 1,
  },
]);

const recorder = metrics.createRecorder({
  accessToken,
  metricSet: "simpleapp-metrics",
  definitions: {
    requestCount: "counter",
  },
  autoFlushMs: 1000,
});

recorder.requestCount.inc();
await recorder.flush();
```

Higher-level app instrumentation:

```js
const metrics = client.metrics.createRecorder({
  accessToken,
  metricSet: "app-echo-metrics",
  definitions: {
    echoReqCount: "counter",
    latencyMs: "histogram",
  },
});

metrics.echoReqCount.inc();
metrics.latencyMs.observe(42);

await metrics.flush();
```

The recorder buffers writes in memory, ensures the metric set lazily on first use, and flushes all buffered rows when you call `flush()`.

Advanced labeled metrics:

```js
const metrics = client.metrics.createRecorder({
  accessToken,
  metricSet: "app-echo-metrics",
  definitions: {
    requestCountByStatus: {
      kind: "counter",
      description: "Requests by status",
      unit: "requests",
      labels: ["status"],
    },
  },
});

metrics.requestCountByStatus.inc({ status: "200" });
await metrics.flush();
```

Prefer a small, bounded label set. If a graph would split into too many lines, the metric probably should have stayed scalar.

### Deployments

```js
const deployments = client.deployments;

await deployments.list(accessToken);
await deployments.create(accessToken, request);
await deployments.delete(accessToken, deploymentID);
```
