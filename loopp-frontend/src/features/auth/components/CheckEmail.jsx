import React from "react";
import { Mail, Clock, RefreshCw, CheckCircle2 } from "lucide-react";

export default function CheckEmail({
  email,
  expiresInHours,
  onResendEmail,
  onIHaveVerified,
  info,
}) {
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
            Check your inbox
          </h1>

          {/* Message block */}
          <div className="mb-6">
            <p className="text-[15px] text-gray-700 leading-relaxed">
              We just sent a secure verification link to
            </p>

            <p className="mt-1 text-[15px] font-semibold text-black break-all bg-gray-50 inline-block px-3 py-1.5 rounded-lg border border-gray-200">
              {email}
            </p>

            <p className="text-sm text-gray-500 leading-relaxed mt-3">
              Open the message and tap the link to continue your setup.
            </p>
          </div>

          {/* Timer */}
          {typeof expiresInHours === "number" && expiresInHours > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 mb-8 text-gray-600 text-sm">
              <Clock className="w-4 h-4" />
              <span>
                Link expires in {expiresInHours} hour
                {expiresInHours === 1 ? "" : "s"}
              </span>
            </div>
          )}

          {/* Optional Info */}
          {info && (
            <div className="mb-8 text-left px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 leading-relaxed shadow-sm">
              {info}
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col gap-3 mb-8">
            {/* Verified button */}
            <button
              onClick={onIHaveVerified}
              className="group w-full bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-black/90 transition-all flex items-center justify-center gap-2"
            >
              <span>I’ve verified my email</span>
              <CheckCircle2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>

            {/* Resend */}
            <button
              onClick={onResendEmail}
              className="group w-full text-black px-6 py-3 rounded-xl border border-gray-300 hover:border-black hover:bg-gray-50 transition-all flex items-center justify-center gap-2 font-medium"
            >
              <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" />
              <span>Resend verification email</span>
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
