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
let onTokenRefreshed = null;
export const setOnTokenRefreshed = (fn) => {
  onTokenRefreshed = typeof fn === "function" ? fn : null;
};

/* ---------------- Axios clients ---------------- */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,         // e.g. https://loopp-backend-v1.onrender.com/api
  withCredentials: true,         // REQUIRED so refresh cookie can be sent
  headers: { "Content-Type": "application/json" },
});

export const formClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  // no Content-Type; axios/browser sets the multipart boundary
});

/* Attach Authorization header from in-memory token */
const attachAuth = (config) => {
  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  } else if (config.headers?.Authorization) {
    delete config.headers.Authorization;
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

/* 401 refresh logic with de-duplication */
let refreshingPromise = null;

const callRefresh = () => {
  // use the configured client (keeps baseURL, withCredentials)
  return apiClient.post("/auth/refresh", {}); // will hit /api/auth/refresh
};

const onResponseError = async (error) => {
  const original = error.config || {};
  const status = error?.response?.status;

  if (status === 401 && !original._retry) {
    original._retry = true;

    try {
      if (!refreshingPromise) {
        refreshingPromise = callRefresh()
          .finally(() => { refreshingPromise = null; });
      }
      const { data } = await refreshingPromise;

      if (data?.accessToken) {
        setAccessToken(data.accessToken);
        onTokenRefreshed && onTokenRefreshed(data.accessToken);

        // inject fresh token on the original request
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${data.accessToken}`;

        // Use the SAME client that sent the original request
        const client =
          original._clientTag === "form" ? formClient : apiClient;

        return client(original);
      }
    } catch {
      setAccessToken(null);
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
  setOnTokenRefreshed,
};
