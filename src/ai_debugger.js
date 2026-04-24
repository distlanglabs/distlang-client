import { createHTTPClient, encodePathPart, queryOptions, requestJSON } from "./http.js";

export function createAIDebuggerClient(config = {}) {
  const http = createHTTPClient(config);

  return {
    async ingest(accessToken, payload) {
      return requestJSON("POST", http.storeBaseURL, "/ai-debugger/v1/ingest", {
        fetch: http.storeFetch,
        accessToken,
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        errorPrefix: "ai debugger request",
      });
    },

    async listSessions(accessToken, options = {}) {
      return requestJSON("GET", http.storeBaseURL, "/ai-debugger/v1/sessions", {
        fetch: http.storeFetch,
        accessToken,
        query: queryOptions({
          project: options.project,
          source: options.source,
          status: options.status,
          limit: options.limit,
          cursor: options.cursor,
        }),
        errorPrefix: "ai debugger request",
      });
    },

    async getSession(accessToken, sessionID) {
      return requestJSON("GET", http.storeBaseURL, `/ai-debugger/v1/sessions/${encodePathPart(sessionID)}`, {
        fetch: http.storeFetch,
        accessToken,
        errorPrefix: "ai debugger request",
      });
    },
  };
}
