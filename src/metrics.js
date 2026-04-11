import { createHTTPClient, encodePathPart, queryOptions, requestJSON } from "./http.js";

export function createMetricsClient(config = {}) {
  const http = createHTTPClient(config);

  return {
    async query(accessToken, query, options = {}) {
      return requestJSON("GET", http.storeBaseURL, "/metrics/v1/api/v1/query", {
        fetch: http.fetch,
        accessToken,
        query: queryOptions({ query, time: options.time }),
        errorPrefix: "metrics request",
      });
    },

    async queryRange(accessToken, query, options = {}) {
      return requestJSON("GET", http.storeBaseURL, "/metrics/v1/api/v1/query_range", {
        fetch: http.fetch,
        accessToken,
        query: queryOptions({ query, start: options.start, end: options.end, step: options.step }),
        errorPrefix: "metrics request",
      });
    },

    async series(accessToken, options = {}) {
      return requestJSON("GET", http.storeBaseURL, "/metrics/v1/api/v1/series", {
        fetch: http.fetch,
        accessToken,
        query: queryOptions({ "match[]": options.match, start: options.start, end: options.end }),
        errorPrefix: "metrics request",
      });
    },

    async labels(accessToken, options = {}) {
      return requestJSON("GET", http.storeBaseURL, "/metrics/v1/api/v1/labels", {
        fetch: http.fetch,
        accessToken,
        query: queryOptions({ "match[]": options.match, start: options.start, end: options.end }),
        errorPrefix: "metrics request",
      });
    },

    async labelValues(accessToken, name, options = {}) {
      return requestJSON("GET", http.storeBaseURL, `/metrics/v1/api/v1/label/${encodePathPart(name)}/values`, {
        fetch: http.fetch,
        accessToken,
        query: queryOptions({ "match[]": options.match, start: options.start, end: options.end }),
        errorPrefix: "metrics request",
      });
    },

    async metadata(accessToken, options = {}) {
      return requestJSON("GET", http.storeBaseURL, "/metrics/v1/api/v1/metadata", {
        fetch: http.fetch,
        accessToken,
        query: queryOptions({ metric: options.metric }),
        errorPrefix: "metrics request",
      });
    },

    metricSets: {
      async ensure(accessToken, metricSet, definitions) {
        await requestJSON("PUT", http.storeBaseURL, `/metrics/v1/metricsets/${encodePathPart(metricSet)}`, {
          fetch: http.fetch,
          accessToken,
          errorPrefix: "metrics request",
        });
        await requestJSON("PUT", http.storeBaseURL, `/metrics/v1/metricsets/${encodePathPart(metricSet)}/metadata`, {
          fetch: http.fetch,
          accessToken,
          body: JSON.stringify({ metrics: definitions }),
          headers: { "Content-Type": "application/json" },
          errorPrefix: "metrics request",
        });
      },

      async appendRows(accessToken, metricSet, rows) {
        await requestJSON("POST", http.storeBaseURL, `/metrics/v1/metricsets/${encodePathPart(metricSet)}/rows`, {
          fetch: http.fetch,
          accessToken,
          body: JSON.stringify({ rows: rows.map((row) => ({ ts: row.windowStart, data: row })) }),
          headers: { "Content-Type": "application/json" },
          errorPrefix: "metrics request",
        });
      },
    },
  };
}
