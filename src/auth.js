import { createHTTPClient, requestJSON } from "./http.js";

export function createAuthClient(config = {}) {
  const http = createHTTPClient(config);

  return {
    async exchangeCLIAuthCode({ code, state, codeVerifier, redirectURI }) {
      return requestJSON("POST", http.authBaseURL, "/auth/cli/exchange", {
        fetch: http.fetch,
        body: JSON.stringify({
          code,
          state,
          code_verifier: codeVerifier,
          redirect_uri: redirectURI,
        }),
        headers: { "Content-Type": "application/json" },
        errorPrefix: "auth request",
      });
    },

    async refresh(refreshToken) {
      return requestJSON("POST", http.authBaseURL, "/auth/refresh", {
        fetch: http.fetch,
        body: JSON.stringify({ refresh_token: refreshToken }),
        headers: { "Content-Type": "application/json" },
        errorPrefix: "auth request",
      });
    },

    async whoAmI(accessToken) {
      return requestJSON("GET", http.authBaseURL, "/auth/whoami", {
        fetch: http.fetch,
        accessToken,
        errorPrefix: "auth request",
      });
    },

    async logout(refreshToken) {
      return requestJSON("POST", http.authBaseURL, "/auth/logout", {
        fetch: http.fetch,
        body: JSON.stringify({ refresh_token: refreshToken }),
        headers: { "Content-Type": "application/json" },
        errorPrefix: "auth request",
      });
    },

    async serviceToken(accessToken, options = {}) {
      const service = typeof options.service === "string" && options.service.trim() !== ""
        ? options.service.trim()
        : "objectdb";
      const rotate = options.rotate === true;
      const response = await requestJSON("POST", http.authBaseURL, "/auth/service-token", {
        fetch: http.fetch,
        accessToken,
        body: JSON.stringify({ service, rotate }),
        headers: { "Content-Type": "application/json" },
        errorPrefix: "auth request",
      });

      if (response && typeof response === "object" && typeof response.access_token !== "string" && typeof response.token === "string") {
        response.access_token = response.token;
      }
      return response;
    },

    async serviceTokenWhoAmI(serviceToken) {
      return requestJSON("GET", http.authBaseURL, "/auth/service-token/whoami", {
        fetch: http.fetch,
        accessToken: serviceToken,
        errorPrefix: "auth request",
      });
    },
  };
}
