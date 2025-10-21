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
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

export const formClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  // DO NOT set Content-Type here; browser/axios sets multipart boundary
});

/* Attach Authorization header from in-memory token */
const attachAuth = (config) => {
  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  } else if (config.headers?.Authorization) {
    // ensure header is not a stale token
    delete config.headers.Authorization;
  }
  return config;
};

// Tag requests so the retry uses the **same** client
apiClient.interceptors.request.use((cfg) => {
  cfg._clientTag = "api";
  return attachAuth(cfg);
});
formClient.interceptors.request.use((cfg) => {
  cfg._clientTag = "form";
  return attachAuth(cfg);
});

/* 401 refresh logic: try once, then fail */
const onResponseError = async (error) => {
  const original = error.config || {};
  const status = error?.response?.status;

  if (status === 401 && !original._retry) {
    original._retry = true;
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true }
      );
      if (data?.accessToken) {
        setAccessToken(data.accessToken);
        onTokenRefreshed && onTokenRefreshed(data.accessToken);

        // inject fresh token on the original request
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${data.accessToken}`;

        // 🔑 Use the SAME client that sent the original request
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
