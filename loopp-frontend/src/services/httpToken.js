// Central token channel with zero deps (no axios, no redux)
// Both authSlice and http.js will use this, avoiding circular imports.

let token = null;

export const getHttpAccessToken = () => token;

export const setHttpAccessToken = (next) => {
  token = next || null;
};

export const clearHttpAccessToken = () => {
  token = null;
  try {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  } catch {}
};
