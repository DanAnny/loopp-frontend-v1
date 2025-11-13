// src/features/auth/components/VerificationSuccess.jsx
import React from "react";
import { CheckCircle2 } from "lucide-react";

export default function VerificationSuccess({ email, onContinue }) {
  return (
    <div className="min-h-[50vh] grid place-items-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-sm p-10 text-center border border-black/10">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2} />
            </div>
          </div>

          <h1 className="text-xl font-semibold tracking-tight mb-2">Email verified</h1>
          <p className="text-gray-600 mb-6">
            <span className="text-black font-medium">{email}</span> is confirmed.
          </p>

          <button
            onClick={onContinue}
            className="w-full bg:black bg-black text-white px-6 py-3 rounded-lg hover:-translate-y-0.5 hover:shadow transition"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
