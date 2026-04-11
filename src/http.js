const DEFAULT_AUTH_BASE_URL = "https://auth.distlang.com";
const DEFAULT_STORE_BASE_URL = "https://api.distlang.com";

export function normalizeBaseURL(value, fallback) {
  const baseURL = String(value || fallback || "").trim().replace(/\/$/, "");
  if (baseURL === "") {
    throw new Error("base URL is required");
  }
  return baseURL;
}

export function resolveFetch(value) {
  if (typeof value === "function") {
    return value;
  }
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis);
  }
  throw new Error("fetch is required; pass config.fetch in environments without a global fetch");
}

export function createHTTPClient(config = {}) {
  return {
    authBaseURL: normalizeBaseURL(config.authBaseURL, DEFAULT_AUTH_BASE_URL),
    storeBaseURL: normalizeBaseURL(config.storeBaseURL, DEFAULT_STORE_BASE_URL),
    fetch: resolveFetch(config.fetch),
  };
}

export function encodePathPart(value) {
  return encodeURIComponent(String(value));
}

export function listOptions(options = {}) {
  const out = [];
  if (typeof options.prefix === "string" && options.prefix !== "") {
    out.push(["prefix", options.prefix]);
  }
  if (typeof options.limit === "number" && Number.isFinite(options.limit) && options.limit > 0) {
    out.push(["limit", String(Math.floor(options.limit))]);
  }
  if (typeof options.cursor === "string" && options.cursor !== "") {
    out.push(["cursor", options.cursor]);
  }
  return out;
}

export function queryOptions(options = {}) {
  const out = [];
  for (const [key, value] of Object.entries(options)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item != null && String(item) !== "") {
          out.push([key, String(item)]);
        }
      }
      continue;
    }
    if (value != null && String(value) !== "") {
      out.push([key, String(value)]);
    }
  }
  return out;
}

export async function requestJSON(method, baseURL, path, options = {}) {
  const url = new URL(path, baseURL);
  if (Array.isArray(options.query)) {
    for (const [key, value] of options.query) {
      url.searchParams.append(key, value);
    }
  }

  const headers = new Headers(options.headers || {});
  if (typeof options.accessToken === "string" && options.accessToken.trim() !== "") {
    headers.set("Authorization", `Bearer ${options.accessToken.trim()}`);
  }

  const request = new Request(url.toString(), {
    method,
    headers,
    body: options.body,
  });
  const res = await options.fetch(request);

  if (res.status === 404 && options.allowNotFound) {
    return null;
  }

  const text = await res.text();
  let payload = null;
  if (text !== "") {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const message = payload && typeof payload === "object" && payload.message
      ? payload.message
      : text || `${res.status} ${res.statusText}`;
    const prefix = typeof options.errorPrefix === "string" && options.errorPrefix !== ""
      ? options.errorPrefix
      : "request";
    throw new Error(`${prefix} failed (${res.status}): ${message}`);
  }

  if (options.expectText) {
    return text;
  }
  return payload;
}

export { DEFAULT_AUTH_BASE_URL, DEFAULT_STORE_BASE_URL };
