export interface ClientConfig {
  authBaseURL?: string;
  storeBaseURL?: string;
  fetch?: typeof globalThis.fetch;
  authFetch?: typeof globalThis.fetch;
  storeFetch?: typeof globalThis.fetch;
}

export type DistlangFetcher = (request: Request) => Promise<Response>;

export interface User {
  id?: string;
  email?: string;
  name?: string;
  avatar_url?: string;
}

export interface WhoAmIResponse {
  user: User;
  token: {
    scope?: string;
    expires_at?: string;
    [key: string]: unknown;
  };
}

export interface ServiceTokenResponse {
  access_token?: string;
  token?: string;
  token_type?: string;
  service?: string;
  [key: string]: unknown;
}

export interface ExchangeCLIAuthCodeInput {
  code: string;
  state: string;
  codeVerifier: string;
  redirectURI: string;
}

export interface ServiceTokenOptions {
  service?: string;
  rotate?: boolean;
}

export interface ListKeysOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

export interface PutValueOptions {
  contentType?: string;
}

export interface GetValueOptions {
  type?: string;
}

export interface QueryRangeOptions {
  start?: string;
  end?: string;
  step?: string;
}

export interface QueryOptions {
  time?: string;
}

export interface SeriesOptions {
  match?: string[];
  start?: string;
  end?: string;
}

export interface MetadataOptions {
  metric?: string;
}

export interface MetricDefinition {
  kind: "counter" | "histogram";
  description: string;
  unit: string;
  labels?: string[];
}

export interface MetricRow {
  windowStart: string;
  metric: string;
  kind: "counter" | "histogram";
  count: number;
  sum: number;
  labels?: Record<string, string>;
  values?: number[];
}

export interface CounterMetricRecorder {
  inc(valueOrLabels?: number | Record<string, string>, maybeLabels?: Record<string, string>): void;
}

export interface HistogramMetricRecorder {
  observe(value: number, labels?: Record<string, string>): void;
}

export interface MetricsRecorderOptions {
  accessToken: string;
  metricSet: string;
  definitions: Record<string, MetricDefinition>;
  windowMs?: number;
  autoFlushMs?: number;
}

export interface MetricsRecorder {
  flush(): Promise<void>;
  [metricName: string]: CounterMetricRecorder | HistogramMetricRecorder | (() => Promise<void>) | unknown;
}

export interface AuthClient {
  exchangeCLIAuthCode(input: ExchangeCLIAuthCodeInput): Promise<Record<string, unknown>>;
  refresh(refreshToken: string): Promise<Record<string, unknown>>;
  whoAmI(accessToken: string): Promise<WhoAmIResponse>;
  logout(refreshToken: string): Promise<Record<string, unknown>>;
  serviceToken(accessToken: string, options?: ServiceTokenOptions): Promise<ServiceTokenResponse>;
  serviceTokenWhoAmI(serviceToken: string): Promise<Record<string, unknown>>;
}

export interface ObjectDBClient {
  status(accessToken: string): Promise<Record<string, unknown>>;
  buckets: {
    list(accessToken: string): Promise<Record<string, unknown>>;
    create(accessToken: string, bucket: string): Promise<Record<string, unknown>>;
    exists(accessToken: string, bucket: string): Promise<boolean>;
    delete(accessToken: string, bucket: string): Promise<Record<string, unknown>>;
  };
  keys: {
    list(accessToken: string, bucket: string, options?: ListKeysOptions): Promise<Record<string, unknown>>;
  };
  put(accessToken: string, bucket: string, key: string, value: unknown, options?: PutValueOptions): Promise<Record<string, unknown>>;
  get(accessToken: string, bucket: string, key: string, options?: GetValueOptions): Promise<unknown>;
  head(accessToken: string, bucket: string, key: string): Promise<Record<string, unknown> | null>;
  delete(accessToken: string, bucket: string, key: string): Promise<Record<string, unknown>>;
}

export interface MetricsClient {
  query(accessToken: string, query: string, options?: QueryOptions): Promise<Record<string, unknown>>;
  queryRange(accessToken: string, query: string, options?: QueryRangeOptions): Promise<Record<string, unknown>>;
  series(accessToken: string, options?: SeriesOptions): Promise<Record<string, unknown>>;
  labels(accessToken: string, options?: SeriesOptions): Promise<Record<string, unknown>>;
  labelValues(accessToken: string, name: string, options?: SeriesOptions): Promise<Record<string, unknown>>;
  metadata(accessToken: string, options?: MetadataOptions): Promise<Record<string, unknown>>;
  metricSets: {
    ensure(accessToken: string, metricSet: string, definitions: Record<string, MetricDefinition>): Promise<void>;
    appendRows(accessToken: string, metricSet: string, rows: MetricRow[]): Promise<void>;
  };
  createRecorder(options: MetricsRecorderOptions): MetricsRecorder;
}

export interface DeploymentsClient {
  create(accessToken: string, request: Record<string, unknown>): Promise<Record<string, unknown>>;
  list(accessToken: string): Promise<Array<Record<string, unknown>>>;
  delete(accessToken: string, deploymentID: string): Promise<Record<string, unknown>>;
}

export interface DistlangClient {
  auth: AuthClient;
  objectdb: ObjectDBClient;
  metrics: MetricsClient;
  deployments: DeploymentsClient;
}

export declare function createDistlangClient(config?: ClientConfig): DistlangClient;
export declare function createDistlangClientWithFetcher(fetcher: DistlangFetcher, config?: Omit<ClientConfig, "fetch">): DistlangClient;
export declare function createAuthClient(config?: ClientConfig): AuthClient;
export declare function createObjectDBClient(config?: ClientConfig): ObjectDBClient;
export declare function createMetricsClient(config?: ClientConfig): MetricsClient;
export declare function createMetricsRecorder(metricsClient: MetricsClient, options: MetricsRecorderOptions): MetricsRecorder;
export declare function createDeploymentsClient(config?: ClientConfig): DeploymentsClient;

export declare const DEFAULT_AUTH_BASE_URL: string;
export declare const DEFAULT_STORE_BASE_URL: string;
