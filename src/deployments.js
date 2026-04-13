import { createHTTPClient, encodePathPart, requestJSON } from "./http.js";

export function createDeploymentsClient(config = {}) {
  const http = createHTTPClient(config);

  return {
    async create(accessToken, request) {
      return requestJSON("POST", http.storeBaseURL, "/deployments/v1", {
        fetch: http.storeFetch,
        accessToken,
        body: JSON.stringify(request),
        headers: { "Content-Type": "application/json" },
        errorPrefix: "deployments request",
      });
    },

    async list(accessToken) {
      const response = await requestJSON("GET", http.storeBaseURL, "/deployments/v1", {
        fetch: http.storeFetch,
        accessToken,
        errorPrefix: "deployments request",
      });
      return response && Array.isArray(response.deployments) ? response.deployments : [];
    },

    async delete(accessToken, deploymentID) {
      return requestJSON("DELETE", http.storeBaseURL, `/deployments/v1/${encodePathPart(deploymentID)}`, {
        fetch: http.storeFetch,
        accessToken,
        errorPrefix: "deployments request",
      });
    },
  };
}
