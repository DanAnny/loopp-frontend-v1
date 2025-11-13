import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import authService from "@/services/auth.service";

export default function VerifyEmail() {
  const [sp] = useSearchParams();
  const token = sp.get("token") || "";
  const email = sp.get("email") || "";
  const [status, setStatus] = useState({ loading: true, ok: false, msg: "" });

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!token) {
        if (alive) {
          setStatus({
            loading: false,
            ok: false,
            msg: "Missing verification token.",
          });
        }
        return;
      }

      try {
        await authService.verifyEmailToken(token);

        // Notify any same-browser tabs in multiple ways (kept from original)
        try {
          localStorage.setItem("loopp.emailVerified", String(Date.now()));
        } catch {}

        try {
          if (window.opener) {
            window.opener.postMessage({ type: "EMAIL_VERIFIED" }, "*");
          }
          window.postMessage({ type: "EMAIL_VERIFIED" }, "*");
        } catch {}

        try {
          const bc = new BroadcastChannel("loopp-events");
          bc.postMessage({ type: "EMAIL_VERIFIED" });
          bc.close();
        } catch {}

        if (alive) {
          setStatus({
            loading: false,
            ok: true,
            msg: "Your email is verified.",
          });
        }

        // ❌ removed auto-close – let user decide what to do with the tab
        // setTimeout(() => {
        //   try {
        //     window.close();
        //   } catch {}
        // }, 1000);
      } catch (e) {
        const msg =
          e?.response?.data?.message ||
          e?.message ||
          "Verification failed or link expired.";
        if (alive) setStatus({ loading: false, ok: false, msg });
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  if (status.loading) {
    return (
      <div className="h-screen grid place-items-center bg-white p-4">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full border-2 border-black/10 flex items-center justify-center bg-white relative">
              <Loader2
                className="w-10 h-10 text-black animate-spin"
                strokeWidth={1.5}
              />
            </div>
          </div>
          <p className="text-xl mb-2">Verifying your email</p>
          <p className="text-sm text-gray-500">Please wait…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen grid place-items-center p-6 bg-white">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-black/10 p-8 text-center shadow-sm">
          {status.ok ? (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9 text-white" strokeWidth={2} />
                </div>
              </div>

              <h1 className="text-3xl mb-3 tracking-tight">Email verified</h1>
              <p className="text-gray-600 mb-2">
                You can return to your previous tab. We’re continuing your setup
                automatically.
              </p>
              <p className="text-xs text-gray-400 mb-8">
                If nothing happens, refresh your sign-up tab.
              </p>

              <div className="pt-6 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-3">
                  Want to jump back into your workspace?
                </p>
                <Link
                  to="/client-sign-in"
                  className="group inline-flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-black/90 transition-all"
                >
                  Go to sign in
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full border-2 border-black flex items-center justify-center bg-white">
                  <XCircle className="w-9 h-9 text-black" strokeWidth={2} />
                </div>
              </div>

              <h1 className="text-3xl mb-3 tracking-tight">
                Your link has expired
              </h1>
              <p className="text-gray-600 mb-2">{status.msg}</p>
              <p className="text-xs text-gray-400 mb-8">
                You can request a fresh verification link from the sign-up page.
              </p>

              <div className="flex flex-col gap-3 pt-4 border-t border-gray-100 mb-2">
                <Link
                  to="/client-sign-in"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-black/90 transition-all text-sm"
                >
                  Client – login
                </Link>
                <Link
                  to="/signin"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 rounded-lg hover:border-black hover:bg-gray-50 transition-all text-sm"
                >
                  Staff – login
                </Link>
              </div>

              {email && (
                <p className="text-xs text-gray-500 mt-2">
                  Tip: request a new verification email for <b>{email}</b> from
                  the sign-up screen.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
