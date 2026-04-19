import test from "node:test";
import assert from "node:assert/strict";

import {
  createAuthClient,
  createDeploymentsClient,
  createDistlangClient,
  createDistlangClientWithFetcher,
  createMetricsClient,
  createMetricsRecorder,
  createObjectDBClient,
  DEFAULT_AUTH_BASE_URL,
  DEFAULT_STORE_BASE_URL,
} from "../src/index.js";

function createFetch(handler) {
  return async (request) => handler(request);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("createDistlangClient wires default clients", async () => {
  const seen = [];
  const client = createDistlangClient({
    fetch: createFetch(async (request) => {
      seen.push(request.url);
      if (request.url === `${DEFAULT_AUTH_BASE_URL}/auth/whoami`) {
        return Response.json({ user: { email: "ada@example.com" }, token: { scope: "user" } });
      }
      if (request.url === `${DEFAULT_STORE_BASE_URL}/objectdb/v1/buckets`) {
        return Response.json({ ok: true, buckets: [] });
      }
      return new Response("not found", { status: 404 });
    }),
  });

  const whoami = await client.auth.whoAmI("access-token");
  const buckets = await client.objectdb.buckets.list("access-token");

  assert.equal(whoami.user.email, "ada@example.com");
  assert.deepEqual(buckets.buckets, []);
  assert.deepEqual(seen, [
    `${DEFAULT_AUTH_BASE_URL}/auth/whoami`,
    `${DEFAULT_STORE_BASE_URL}/objectdb/v1/buckets`,
  ]);
});

test("createDistlangClientWithFetcher routes auth and store requests through the supplied fetcher", async () => {
  const seen = [];
  const client = createDistlangClientWithFetcher(createFetch(async (request) => {
    seen.push(request.url);
    if (request.url === "https://auth.example.com/auth/whoami") {
      return Response.json({ user: { email: "ada@example.com" }, token: { scope: "user" } });
    }
    if (request.url === "https://api.example.com/objectdb/v1/buckets") {
      return Response.json({ ok: true, buckets: [] });
    }
    return new Response("not found", { status: 404 });
  }), {
    authBaseURL: "https://auth.example.com",
    storeBaseURL: "https://api.example.com",
  });

  const whoami = await client.auth.whoAmI("access-token");
  const buckets = await client.objectdb.buckets.list("access-token");

  assert.equal(whoami.user.email, "ada@example.com");
  assert.deepEqual(buckets.buckets, []);
  assert.deepEqual(seen, [
    "https://auth.example.com/auth/whoami",
    "https://api.example.com/objectdb/v1/buckets",
  ]);
});

test("auth client exchanges CLI auth code", async () => {
  const auth = createAuthClient({
    authBaseURL: "https://auth.example.com",
    fetch: createFetch(async (request) => {
      assert.equal(request.url, "https://auth.example.com/auth/cli/exchange");
      assert.equal(request.method, "POST");
      assert.equal(request.headers.get("content-type"), "application/json");
      const body = await request.json();
      assert.deepEqual(body, {
        code: "code-123",
        state: "state-123",
        code_verifier: "verifier-123",
        redirect_uri: "http://127.0.0.1:8976/callback",
      });
      return Response.json({ access_token: "access", refresh_token: "refresh", expires_in: 900, token_type: "Bearer" });
    }),
  });

  const response = await auth.exchangeCLIAuthCode({
    code: "code-123",
    state: "state-123",
    codeVerifier: "verifier-123",
    redirectURI: "http://127.0.0.1:8976/callback",
  });

  assert.equal(response.access_token, "access");
});

test("auth client normalizes service token fallback", async () => {
  const auth = createAuthClient({
    fetch: createFetch(async (request) => {
      assert.equal(request.headers.get("authorization"), "Bearer access-token");
      return Response.json({ token: "dsts_live_123", token_type: "Bearer" });
    }),
  });

  const response = await auth.serviceToken("access-token", { service: "objectdb" });
  assert.equal(response.access_token, "dsts_live_123");
});

test("objectdb client sends JSON put and can get not found", async () => {
  const objectdb = createObjectDBClient({
    storeBaseURL: "https://api.example.com",
    fetch: createFetch(async (request) => {
      if (request.method === "PUT") {
        assert.equal(request.url, "https://api.example.com/objectdb/v1/buckets/demo/values/profile.json");
        assert.equal(request.headers.get("authorization"), "Bearer access-token");
        assert.equal(request.headers.get("content-type"), "application/json");
        const body = await request.text();
        assert.equal(body, '{"ok":true}');
        return Response.json({ ok: true, bucket: "demo", key: "profile.json" });
      }

      assert.equal(request.url, "https://api.example.com/objectdb/v1/buckets/demo/values/profile.json?type=json");
      return new Response("", { status: 404 });
    }),
  });

  await objectdb.put("access-token", "demo", "profile.json", { ok: true });
  const result = await objectdb.get("access-token", "demo", "profile.json");
  assert.equal(result, null);
});

test("objectdb client head resolves metadata from keys list", async () => {
  const objectdb = createObjectDBClient({
    fetch: createFetch(async (request) => {
      assert.equal(request.url, `${DEFAULT_STORE_BASE_URL}/objectdb/v1/buckets/demo/keys?prefix=folder%2Fprofile.json&limit=1000`);
      return Response.json({
        ok: true,
        keys: [
          { name: "folder/profile.json", metadata: { contentType: "application/json", size: 12 } },
        ],
      });
    }),
  });

  const metadata = await objectdb.head("access-token", "demo", "folder/profile.json");
  assert.deepEqual(metadata, { contentType: "application/json", size: 12 });
});

test("metrics client encodes range query and label values", async () => {
  const seen = [];
  const metrics = createMetricsClient({
    storeBaseURL: "https://api.example.com",
    fetch: createFetch(async (request) => {
      seen.push(request.url);
      return Response.json({ status: "success", data: [] });
    }),
  });

  await metrics.queryRange("access-token", "up", {
    start: "2026-04-10T00:00:00Z",
    end: "2026-04-10T01:00:00Z",
    step: "60s",
  });
  await metrics.labelValues("access-token", "job", { match: ["up", "process_start_time_seconds"] });

  assert.deepEqual(seen, [
    "https://api.example.com/metrics/v1/api/v1/query_range?query=up&start=2026-04-10T00%3A00%3A00Z&end=2026-04-10T01%3A00%3A00Z&step=60s",
    "https://api.example.com/metrics/v1/api/v1/label/job/values?match%5B%5D=up&match%5B%5D=process_start_time_seconds",
  ]);
});

test("metrics client writes metric set metadata and rows", async () => {
  const seen = [];
  const metrics = createMetricsClient({
    fetch: createFetch(async (request) => {
      seen.push({
        method: request.method,
        url: request.url,
        body: request.method === "GET" ? null : await request.text(),
      });
      return Response.json({ ok: true });
    }),
  });

  await metrics.metricSets.ensure("access-token", "simpleapp-metrics", {
    requestCount: {
      kind: "counter",
      description: "Requests served",
      unit: "requests",
      labels: ["route"],
    },
  });
  await metrics.metricSets.appendRows("access-token", "simpleapp-metrics", [
    {
      windowStart: "2026-04-10T12:00:00Z",
      metric: "requestCount",
      kind: "counter",
      count: 1,
      sum: 1,
      labels: { route: "/" },
    },
  ]);

  assert.deepEqual(seen, [
    {
      method: "PUT",
      url: `${DEFAULT_STORE_BASE_URL}/metrics/v1/metricsets/simpleapp-metrics`,
      body: "",
    },
    {
      method: "PUT",
      url: `${DEFAULT_STORE_BASE_URL}/metrics/v1/metricsets/simpleapp-metrics/metadata`,
      body: '{"metrics":{"requestCount":{"kind":"counter","description":"Requests served","unit":"requests","labels":["route"]}}}',
    },
    {
      method: "POST",
      url: `${DEFAULT_STORE_BASE_URL}/metrics/v1/metricsets/simpleapp-metrics/rows`,
      body: '{"rows":[{"ts":"2026-04-10T12:00:00Z","data":{"windowStart":"2026-04-10T12:00:00Z","metric":"requestCount","kind":"counter","count":1,"sum":1,"labels":{"route":"/"}}}]}',
    },
  ]);
});

test("metrics client createRecorder ensures once and flushes aggregated rows", async () => {
  const calls = [];
  const client = createMetricsClient({
    fetch: createFetch(async (request) => {
      calls.push({
        method: request.method,
        url: request.url,
        body: request.method === "GET" ? null : await request.text(),
      });
      return Response.json({ ok: true });
    }),
  });

  const recorder = client.createRecorder({
    accessToken: "access-token",
    metricSet: "app-echo-metrics",
    definitions: {
      echoReqCount: {
        kind: "counter",
        description: "Number of echo requests handled",
        unit: "requests",
        labels: ["route", "method", "status"],
      },
    },
  });

  recorder.echoReqCount.inc({ route: "/echo/:text", method: "GET", status: "200" });
  recorder.echoReqCount.inc(2, { route: "/echo/:text", method: "GET", status: "200" });

  assert.equal(calls.length, 0);
  await recorder.flush();
  assert.equal(calls.length, 3);
  assert.equal(calls[0].method, "PUT");
  assert.equal(calls[1].method, "PUT");
  assert.equal(calls[2].method, "POST");

  const payload = JSON.parse(calls[2].body);
  assert.equal(payload.rows.length, 1);
  assert.equal(payload.rows[0].data.metric, "echoReqCount");
  assert.equal(payload.rows[0].data.count, 2);
  assert.equal(payload.rows[0].data.sum, 3);

  await recorder.flush();
  assert.equal(calls.length, 3);
});

test("metrics client createRecorder accepts scalar shorthand definitions", async () => {
  const calls = [];
  const client = createMetricsClient({
    fetch: createFetch(async (request) => {
      calls.push({
        method: request.method,
        url: request.url,
        body: request.method === "GET" ? null : await request.text(),
      });
      return Response.json({ ok: true });
    }),
  });

  const recorder = client.createRecorder({
    accessToken: "access-token",
    metricSet: "app-echo-metrics",
    definitions: {
      requestCount: "counter",
      latencyMs: "histogram",
    },
  });

  recorder.requestCount.inc();
  recorder.latencyMs.observe(42);
  await recorder.flush();

  assert.equal(calls.length, 3);
  assert.equal(calls[1].method, "PUT");
  assert.equal(
    calls[1].body,
    '{"metrics":{"requestCount":{"kind":"counter","description":"requestCount","unit":"count","labels":[]},"latencyMs":{"kind":"histogram","description":"latencyMs","unit":"value","labels":[]}}}',
  );

  const payload = JSON.parse(calls[2].body);
  assert.equal(payload.rows.length, 2);
  assert.deepEqual(payload.rows.map((row) => row.data.metric).sort(), ["latencyMs", "requestCount"]);
});

test("metrics recorder auto-flushes buffered rows", async () => {
  const calls = [];
  const recorder = createMetricsRecorder({
    metricSets: {
      async ensure() {
        calls.push({ type: "ensure" });
      },
      async appendRows(_accessToken, _metricSet, rows) {
        calls.push({ type: "append", rows });
      },
    },
  }, {
    accessToken: "access-token",
    metricSet: "app-echo-metrics",
    autoFlushMs: 20,
    definitions: {
      requestCount: {
        kind: "counter",
        description: "Requests",
        unit: "requests",
        labels: ["route"],
      },
    },
  });

  recorder.requestCount.inc({ route: "/" });
  recorder.requestCount.inc({ route: "/" });
  assert.deepEqual(calls, [{ type: "ensure" }]);

  await delay(40);

  assert.equal(calls.length, 2);
  assert.equal(calls[0].type, "ensure");
  assert.equal(calls[1].type, "append");
  assert.equal(calls[1].rows.length, 1);
  assert.equal(calls[1].rows[0].count, 2);
  assert.equal(calls[1].rows[0].sum, 2);
});

test("metrics recorder can disable auto-flush", async () => {
  const calls = [];
  const recorder = createMetricsRecorder({
    metricSets: {
      async ensure() {
        calls.push("ensure");
      },
      async appendRows() {
        calls.push("append");
      },
    },
  }, {
    accessToken: "access-token",
    metricSet: "app-echo-metrics",
    autoFlushMs: 0,
    definitions: {
      requestCount: {
        kind: "counter",
        description: "Requests",
        unit: "requests",
        labels: [],
      },
    },
  });

  recorder.requestCount.inc();
  await delay(30);
  assert.deepEqual(calls, ["ensure"]);

  await recorder.flush();
  assert.deepEqual(calls, ["ensure", "append"]);
});

test("metrics recorder explicit flush overrides pending auto-flush", async () => {
  const calls = [];
  const recorder = createMetricsRecorder({
    metricSets: {
      async ensure() {
        calls.push("ensure");
      },
      async appendRows(_accessToken, _metricSet, rows) {
        calls.push(`append:${rows.length}`);
      },
    },
  }, {
    accessToken: "access-token",
    metricSet: "app-echo-metrics",
    autoFlushMs: 100,
    definitions: {
      requestCount: {
        kind: "counter",
        description: "Requests",
        unit: "requests",
        labels: [],
      },
    },
  });

  recorder.requestCount.inc();
  await recorder.flush();
  await delay(130);

  assert.deepEqual(calls, ["ensure", "append:1"]);
});

test("createDistlangClientWithFetcher recorder flushes through supplied fetcher", async () => {
  const calls = [];
  const client = createDistlangClientWithFetcher(createFetch(async (request) => {
    calls.push({
      method: request.method,
      url: request.url,
      body: request.method === "GET" ? null : await request.text(),
    });
    return Response.json({ ok: true });
  }), {
    storeBaseURL: "https://api.example.com",
  });

  const recorder = client.metrics.createRecorder({
    accessToken: "access-token",
    metricSet: "app-echo-metrics",
    definitions: {
      requestCount: {
        kind: "counter",
        description: "Requests served",
        unit: "requests",
        labels: ["route"],
      },
    },
  });

  recorder.requestCount.inc({ route: "/" });
  await recorder.flush();

  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((entry) => entry.url), [
    "https://api.example.com/metrics/v1/metricsets/app-echo-metrics",
    "https://api.example.com/metrics/v1/metricsets/app-echo-metrics/metadata",
    "https://api.example.com/metrics/v1/metricsets/app-echo-metrics/rows",
  ]);
});

test("metrics recorder preserves histogram samples", async () => {
  const appended = [];
  const recorder = createMetricsRecorder({
    metricSets: {
      async ensure() {},
      async appendRows(_accessToken, _metricSet, rows) {
        appended.push(rows);
      },
    },
  }, {
    accessToken: "access-token",
    metricSet: "app-echo-metrics",
    definitions: {
      latencyMs: {
        kind: "histogram",
        description: "Latency",
        unit: "ms",
        labels: ["route"],
      },
    },
  });

  recorder.latencyMs.observe(42, { route: "/echo/:text" });
  recorder.latencyMs.observe(18, { route: "/echo/:text" });
  await recorder.flush();

  assert.equal(appended.length, 1);
  assert.equal(appended[0].length, 1);
  assert.deepEqual(appended[0][0].values, [42, 18]);
  assert.equal(appended[0][0].count, 2);
  assert.equal(appended[0][0].sum, 60);
});

test("metrics recorder validates labels", async () => {
  const recorder = createMetricsRecorder({
    metricSets: {
      async ensure() {},
      async appendRows() {},
    },
  }, {
    accessToken: "access-token",
    metricSet: "app-echo-metrics",
    definitions: {
      echoReqCount: {
        kind: "counter",
        description: "Requests",
        unit: "requests",
        labels: ["route", "status"],
      },
    },
  });

  assert.throws(
    () => recorder.echoReqCount.inc({ route: "/", method: "GET" }),
    /missing label: status/,
  );
  assert.throws(
    () => recorder.echoReqCount.inc({ route: "/", status: "200", extra: "x" }),
    /unexpected label: extra/,
  );
});

test("metrics recorder flush waits for lazy ensure before append", async () => {
  const order = [];
  let releaseEnsure;
  const ensureDone = new Promise((resolve) => {
    releaseEnsure = resolve;
  });

  const recorder = createMetricsRecorder({
    metricSets: {
      async ensure() {
        order.push("ensure:start");
        await ensureDone;
        order.push("ensure:end");
      },
      async appendRows() {
        order.push("append");
      },
    },
  }, {
    accessToken: "access-token",
    metricSet: "app-echo-metrics",
    definitions: {
      echoReqCount: {
        kind: "counter",
        description: "Requests",
        unit: "requests",
        labels: [],
      },
    },
  });

  recorder.echoReqCount.inc();
  const flushPromise = recorder.flush();
  order.push("flush:waiting");
  releaseEnsure();
  await flushPromise;

  assert.deepEqual(order, ["ensure:start", "flush:waiting", "ensure:end", "append"]);
});

test("deployments client lists and creates deployments", async () => {
  const deployments = createDeploymentsClient({
    storeBaseURL: "https://api.example.com",
    fetch: createFetch(async (request) => {
      if (request.method === "GET") {
        return Response.json({ ok: true, deployments: [{ id: "dep_123", app: "echo" }] });
      }
      if (request.method === "POST") {
        const body = await request.json();
        assert.equal(body.app, "echo");
        return Response.json({ ok: true, deployment: { id: "dep_123", app: "echo" } });
      }
      return Response.json({ ok: true });
    }),
  });

  const listed = await deployments.list("access-token");
  const created = await deployments.create("access-token", { app: "echo" });

  assert.equal(listed[0].id, "dep_123");
  assert.equal(created.deployment.id, "dep_123");
});

test("request errors include API message", async () => {
  const auth = createAuthClient({
    fetch: createFetch(async () => Response.json({ message: "nope" }, { status: 401 })),
  });

  await assert.rejects(() => auth.whoAmI("bad-token"), /auth request failed \(401\): nope/);
});
