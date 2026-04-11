import test from "node:test";
import assert from "node:assert/strict";

import {
  createAuthClient,
  createDeploymentsClient,
  createDistlangClient,
  createMetricsClient,
  createObjectDBClient,
  DEFAULT_AUTH_BASE_URL,
  DEFAULT_STORE_BASE_URL,
} from "../src/index.js";

function createFetch(handler) {
  return async (request) => handler(request);
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
