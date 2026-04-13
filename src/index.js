import { createAuthClient } from "./auth.js";
import { createDeploymentsClient } from "./deployments.js";
import { createMetricsClient } from "./metrics.js";
import { createMetricsRecorder } from "./metrics_recorder.js";
import { createObjectDBClient } from "./objectdb.js";
import { createHTTPClientWithFetcher, DEFAULT_AUTH_BASE_URL, DEFAULT_STORE_BASE_URL } from "./http.js";

export function createDistlangClient(config = {}) {
  return {
    auth: createAuthClient(config),
    objectdb: createObjectDBClient(config),
    metrics: createMetricsClient(config),
    deployments: createDeploymentsClient(config),
  };
}

export function createDistlangClientWithFetcher(fetcher, config = {}) {
  const nextConfig = createHTTPClientWithFetcher(fetcher, config);
  return createDistlangClient(nextConfig);
}

export {
  createAuthClient,
  createDeploymentsClient,
  createMetricsClient,
  createMetricsRecorder,
  createObjectDBClient,
  DEFAULT_AUTH_BASE_URL,
  DEFAULT_STORE_BASE_URL,
};
