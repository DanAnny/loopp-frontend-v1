// src/features/auth/components/EmailTemplate.jsx
import React from "react";
import { Mail } from "lucide-react";

export default function EmailTemplate({ email, onVerify }) {
  return (
    <div className="w-full max-w-2xl mx-auto bg-white shadow-lg border border-black/10 rounded-lg overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm">
                <span className="text-black font-medium">Loopp</span>{" "}
                <span className="text-gray-500">{'<noreply@loopp.com>'}</span>
              </p>
              <p className="text-xs text-gray-500">to {email}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Just now</p>
        </div>
        <h2 className="text-sm text-black">Verify your email address</h2>
      </div>

      <div className="px-10 py-12">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 border-2 border-black rounded-lg flex items-center justify-center">
            <Mail className="w-8 h-8 text-black" strokeWidth={2} />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold tracking-tight mb-3">Verify your email address</h1>
          <p className="text-gray-600">Thanks for signing up! Click the button below to confirm your email.</p>
        </div>

        <div className="flex justify-center mb-8">
          <button
            onClick={onVerify}
            className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition"
          >
            Verify Email
          </button>
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">Or copy and paste this link into your browser:</p>
          <p className="text-xs text-gray-500 break-all bg-gray-50 p-3 rounded border border-gray-200">
            https://app.loopp.com/verify?token=DEMO_TOKEN
          </p>
        </div>

        <div className="border-t border-gray-200 mt-10 pt-6 text-center text-xs text-gray-500">
          This link expires in 24 hours. If you didn’t create an account, ignore this email.
        </div>
      </div>
    </div>
  );
}
