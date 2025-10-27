// frontend/src/services/http.js
import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5500/api";
export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5500";

/* ---------------- In-memory auth token helpers ---------------- */
let accessToken = null;
export const setAccessToken = (token) => {
  accessToken = token || null;
};
export const clearAccessToken = () => {
  accessToken = null;
};

let onTokenRefreshed = null;
export const setOnTokenRefreshed = (fn) => {
  onTokenRefreshed = typeof fn === "function" ? fn : null;
};

/* ---------------- Axios clients ---------------- */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,        // e.g. https://loopp-backend-v1.onrender.com/api
  withCredentials: true,        // REQUIRED so refresh cookie is sent
  headers: { "Content-Type": "application/json" },
  // optional: short timeouts are helpful in logout flows
  timeout: 200000,
});

export const formClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 200000,
  // no Content-Type; axios/browser sets the multipart boundary
});

/* Attach Authorization header from in-memory token */
const attachAuth = (config) => {
  // tag requests so the retry uses the SAME client
  if (!config._clientTag) config._clientTag = "api";

  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
    config._hadAuth = true;
  } else {
    if (config.headers?.Authorization) delete config.headers.Authorization;
    config._hadAuth = false;
  }
  return config;
};

// Tag requests so the retry uses the SAME client
apiClient.interceptors.request.use((cfg) => {
  cfg._clientTag = "api";
  return attachAuth(cfg);
});
formClient.interceptors.request.use((cfg) => {
  cfg._clientTag = "form";
  return attachAuth(cfg);
});

/* 401 refresh logic with de-duplication and guards */
let refreshingPromise = null;

const callRefresh = () => {
  // use the configured client (keeps baseURL, withCredentials)
  return apiClient.post("/auth/refresh", {});
};

const onResponseError = async (error) => {
  const original = error.config || {};
  const status = error?.response?.status;

  // Never try to refresh for auth endpoints themselves
  const url = String(original.url || "");
  const isAuthEndpoint = /\/auth\/(signin|signup|customer\/signup|logout|refresh)\b/.test(url);

  // Only consider refreshing when the original request was authenticated
  const hadAuth =
    !!original._hadAuth || !!(original.headers && original.headers.Authorization);

  if (status === 401 && !original._retry && hadAuth && !isAuthEndpoint) {
    original._retry = true;

    try {
      if (!refreshingPromise) {
        refreshingPromise = callRefresh().finally(() => {
          refreshingPromise = null;
        });
      }
      const { data } = await refreshingPromise;

      if (data?.accessToken) {
        setAccessToken(data.accessToken);
        if (onTokenRefreshed) onTokenRefreshed(data.accessToken);

        // inject fresh token on the original request
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${data.accessToken}`;

        // Use the SAME client that sent the original request
        const client = original._clientTag === "form" ? formClient : apiClient;
        return client(original);
      }
    } catch {
      // refresh failed; drop token so UI can react (e.g., redirect to login)
      clearAccessToken();
    }
  }

  return Promise.reject(error);
};

apiClient.interceptors.response.use((r) => r, onResponseError);
formClient.interceptors.response.use((r) => r, onResponseError);

export default {
  API_BASE_URL,
  SOCKET_URL,
  apiClient,
  formClient,
  setAccessToken,
  clearAccessToken,
  setOnTokenRefreshed,
};
