// frontend/src/features/auth/components/CheckEmail.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  Mail,
  Clock,
  RefreshCw,
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react";
import authService from "@/services/auth.service";
import { toast } from "sonner";

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 120; // 2 minutes

export default function CheckEmail({
  email,
  expiresInMinutes, // from backend (optional, defaults to 2)
  onResendEmail, // optional external handler
  onIHaveVerified, // called when OTP is valid
  info,
}) {
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [status, setStatus] = useState({
    checking: false,
    success: false,
    error: "",
  });
  const [secondsLeft, setSecondsLeft] = useState(
    (expiresInMinutes || OTP_TTL_SECONDS / 60) * 60
  );
  const inputsRef = useRef([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const next = [...digits];
    next[index] = value.slice(-1);
    setDigits(next);
    setStatus({ checking: false, success: false, error: "" });

    if (value && index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }

    const joined = next.join("");
    if (joined.length === OTP_LENGTH) {
      verifyOtp(joined);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (text.length !== OTP_LENGTH) return;
    const next = text.split("").slice(0, OTP_LENGTH);
    setDigits(next);
    verifyOtp(next.join(""));
  };

  const verifyOtp = async (code) => {
    // UX guard – real expiry check still happens on the backend
    if (secondsLeft <= 0) {
      const msg =
        "This code has timed out. Tap ‘Resend code’ to get a fresh one.";
      setStatus({
        checking: false,
        success: false,
        error: msg,
      });
      toast.error(msg);
      return;
    }

    if (!email) {
      const msg = "We couldn’t find your email. Please restart the sign-up.";
      setStatus({
        checking: false,
        success: false,
        error: msg,
      });
      toast.error(msg);
      return;
    }

    try {
      setStatus({ checking: true, success: false, error: "" });

      // Backend expects { email, code } (and also supports `otp`)
      await authService.verifyEmailOtp({ email, code });

      setStatus({ checking: false, success: true, error: "" });

      toast.success("Email verified. Creating your chat room…");

      setTimeout(() => {
        onIHaveVerified?.();
      }, 2000);
    } catch (e) {
      const raw =
        e?.response?.data?.message ||
        e?.message ||
        "We couldn’t verify that code.";

      let friendly = "That code doesn’t look right. Please check it and try again.";

      if (/expired/i.test(raw)) {
        friendly =
          "This code has expired. Tap ‘Resend code’ to get a new one.";
      } else if (/no active verification code/i.test(raw)) {
        friendly =
          "There’s no active code for this email. Please request a new one.";
      } else if (/user not found/i.test(raw)) {
        friendly =
          "We couldn’t find that account. Please check the email address.";
      }

      setStatus({ checking: false, success: false, error: friendly });
      toast.error(friendly);
    }
  };

  const resend = async () => {
    // UX: block resends while timer is still counting down
    if (secondsLeft > 0) {
      toast.error("You can request a new code once this one expires.");
      return;
    }

    if (onResendEmail) {
      onResendEmail();
    } else {
      try {
        await authService.resendVerificationEmail();
        toast.success("We’ve sent a new code to your email.");
      } catch (e) {
        const raw =
          e?.response?.data?.message ||
          e?.message ||
          "Could not resend verification code.";
        toast.error(raw);
      }
    }

    setDigits(Array(OTP_LENGTH).fill(""));
    setStatus({ checking: false, success: false, error: "" });
    setSecondsLeft((expiresInMinutes || OTP_TTL_SECONDS / 60) * 60);
    inputsRef.current[0]?.focus();
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="h-screen grid place-items-center px-6 bg-gradient-to-b from-white to-[#fafafa]">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-black/10 shadow-[0_8px_24px_rgba(0,0,0,0.05)] p-10 text-center">
          {/* Icon */}
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 rounded-2xl border border-black/10 shadow-sm flex items-center justify-center bg-white relative">
              <Mail className="w-10 h-10 text-black" strokeWidth={1.4} />
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-black rounded-full shadow-sm" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-[28px] font-semibold tracking-tight mb-3 text-black">
            Enter your verification code
          </h1>

          {/* Message block */}
          <div className="mb-6">
            <p className="text-[15px] text-gray-700 leading-relaxed">
              We just emailed a 6-digit code to
            </p>

            <p className="mt-1 text-[15px] font-semibold text-black break-all bg-gray-50 inline-block px-3 py-1.5 rounded-lg border border-gray-200">
              {email}
            </p>

            <p className="text-sm text-gray-500 leading-relaxed mt-3">
              Type or paste the code below to continue.
            </p>
          </div>

          {/* OTP input row */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {Array.from({ length: OTP_LENGTH }).map((_, idx) => (
              <input
                key={idx}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digits[idx]}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={idx === 0 ? handlePaste : undefined}
                ref={(el) => (inputsRef.current[idx] = el)}
                className="w-10 h-12 border border-gray-300 rounded-lg text-center text-lg font-medium focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
              />
            ))}

            {/* Status icon beside inputs */}
            <div className="w-8 h-8 flex items-center justify-center">
              {status.checking && (
                <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
              )}
              {!status.checking && status.success && (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              )}
              {!status.checking && status.error && (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
            </div>
          </div>

          {/* Timer text */}
          <div className="mb-6 flex flex-col items-center gap-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 text-sm">
              <Clock className="w-4 h-4" />
              {secondsLeft > 0 ? (
                <span>
                  Code expires in {minutes}:
                  {seconds.toString().padStart(2, "0")}
                </span>
              ) : (
                <span>Code expired. You can request a new one.</span>
              )}
            </div>
          </div>

          {/* Optional Info */}
          {info && (
            <div className="mb-6 text-left px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 leading-relaxed shadow-sm">
              {info}
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col gap-3 mb-6">
            <button
              onClick={() => {
                const code = digits.join("");
                if (code.length === OTP_LENGTH) {
                  verifyOtp(code);
                } else {
                  toast.error(
                    "Please enter the full 6-digit verification code."
                  );
                }
              }}
              disabled={status.checking || secondsLeft <= 0}
              className="group w-full bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-black/90 disabled:bg-black/40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              <span>Verify code</span>
              <CheckCircle2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>

            <button
              onClick={resend}
              disabled={status.checking || secondsLeft > 0}
              className={`group w-full text-black px-6 py-3 rounded-xl border border-gray-300 transition-all flex items-center justify-center gap-2 font-medium
                ${
                  secondsLeft > 0
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:border-black hover:bg-gray-50"
                }`}
            >
              <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" />
              <span>
                {secondsLeft > 0 ? "Resend available after expiry" : "Resend code"}
              </span>
            </button>
          </div>

          {/* Footer */}
          <p className="text-xs text-gray-400">
            Didn’t get it? Check your spam or promotions folder.
          </p>
        </div>
      </div>
    </div>
  );
}
