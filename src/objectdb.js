import { createHTTPClient, encodePathPart, listOptions, requestJSON } from "./http.js";

export function createObjectDBClient(config = {}) {
  const http = createHTTPClient(config);

  return {
    async status(accessToken) {
      return requestJSON("GET", http.storeBaseURL, "/objectdb/v1", {
        fetch: http.storeFetch,
        accessToken,
        errorPrefix: "objectdb request",
      });
    },

    buckets: {
      async list(accessToken) {
        return requestJSON("GET", http.storeBaseURL, "/objectdb/v1/buckets", {
          fetch: http.storeFetch,
          accessToken,
          errorPrefix: "objectdb request",
        });
      },

      async create(accessToken, bucket) {
        return requestJSON("PUT", http.storeBaseURL, `/objectdb/v1/buckets/${encodePathPart(bucket)}`, {
          fetch: http.storeFetch,
          accessToken,
          errorPrefix: "objectdb request",
        });
      },

      async exists(accessToken, bucket) {
        const result = await requestJSON("GET", http.storeBaseURL, "/objectdb/v1/buckets", {
          fetch: http.storeFetch,
          accessToken,
          errorPrefix: "objectdb request",
        });
        const target = String(bucket);
        return !!(result && Array.isArray(result.buckets) && result.buckets.find((entry) => entry && entry.name === target));
      },

      async delete(accessToken, bucket) {
        return requestJSON("DELETE", http.storeBaseURL, `/objectdb/v1/buckets/${encodePathPart(bucket)}`, {
          fetch: http.storeFetch,
          accessToken,
          errorPrefix: "objectdb request",
        });
      },
    },

    keys: {
      async list(accessToken, bucket, options = {}) {
        return requestJSON("GET", http.storeBaseURL, `/objectdb/v1/buckets/${encodePathPart(bucket)}/keys`, {
          fetch: http.storeFetch,
          accessToken,
          query: listOptions(options),
          errorPrefix: "objectdb request",
        });
      },
    },

    async put(accessToken, bucket, key, value, options = {}) {
      let body;
      let contentType = typeof options.contentType === "string" ? options.contentType : "";
      if (typeof value === "string") {
        body = value;
        if (contentType === "") {
          contentType = "text/plain; charset=utf-8";
        }
      } else if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
        body = value;
        if (contentType === "") {
          contentType = "application/octet-stream";
        }
      } else {
        body = JSON.stringify(value);
        if (contentType === "") {
          contentType = "application/json";
        }
      }

      return requestJSON("PUT", http.storeBaseURL, `/objectdb/v1/buckets/${encodePathPart(bucket)}/values/${encodePathPart(key)}`, {
        fetch: http.storeFetch,
        accessToken,
        body,
        headers: { "Content-Type": contentType },
        errorPrefix: "objectdb request",
      });
    },

    async get(accessToken, bucket, key, options = {}) {
      const responseType = typeof options.type === "string" ? options.type : "json";
      return requestJSON("GET", http.storeBaseURL, `/objectdb/v1/buckets/${encodePathPart(bucket)}/values/${encodePathPart(key)}`, {
        fetch: http.storeFetch,
        accessToken,
        query: responseType ? [["type", responseType]] : [],
        allowNotFound: true,
        expectText: responseType !== "json",
        errorPrefix: "objectdb request",
      });
    },

    async head(accessToken, bucket, key) {
      const listed = await requestJSON("GET", http.storeBaseURL, `/objectdb/v1/buckets/${encodePathPart(bucket)}/keys`, {
        fetch: http.storeFetch,
        accessToken,
        query: [["prefix", String(key)], ["limit", "1000"]],
        errorPrefix: "objectdb request",
      });
      if (!listed || !Array.isArray(listed.keys)) {
        return null;
      }
      const found = listed.keys.find((entry) => entry && entry.name === String(key));
      return found ? found.metadata || null : null;
    },

    async delete(accessToken, bucket, key) {
      return requestJSON("DELETE", http.storeBaseURL, `/objectdb/v1/buckets/${encodePathPart(bucket)}/values/${encodePathPart(key)}`, {
        fetch: http.storeFetch,
        accessToken,
        errorPrefix: "objectdb request",
      });
    },
  };
}
