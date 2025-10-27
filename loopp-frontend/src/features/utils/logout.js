import { persistor } from "@/store/persistor";
import { store } from "@/store";
import { logout } from "@/features/auth/authSlice";

export function forceLogout() {
  try {
    // Read role BEFORE clearing storage
    let role = null;
    try { role = localStorage.getItem("role"); } catch {}

    // 1) Clear Redux auth state
    store.dispatch(logout());

    // 2) Purge redux-persist safely (no refresh loop)
    persistor.purge();

    // 3) Remove manual tokens/flags
    try {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("persist:loopp");
      // don't remove "role" before we compute redirect
    } catch {}

    // 4) Redirect by role
    if (role === "client") {
      window.location.replace("/client-sign-in");
    } else {
      window.location.replace("/signin");
    }
  } catch (err) {
    console.error("forceLogout error:", err);
    window.location.replace("/signin");
  }
}
