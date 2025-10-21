// src/pages/AddStaff.jsx
import React, { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { addUser } from "@/services/auth.service"; // named export

export default function AddStaff() {
  const navigate = useNavigate();

  // Current logged-in user from Redux
  const me = useSelector((s) => s.auth?.user);
  const myRole = (me?.role || "").toString();
  const isSuperAdmin = /superadmin/i.test(myRole);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [phone,     setPhone]     = useState("");
  const [gender,    setGender]    = useState("");
  const [role,      setRole]      = useState(""); // PM | Engineer | Admin (shown only if SuperAdmin)

  // UI state
  const [loading,   setLoading]   = useState(false);
  const [err,       setErr]       = useState("");
  const [ok,        setOk]        = useState("");

  const roleOptions = useMemo(() => {
    const base = [
      { value: "", label: "Select Role…" },
      { value: "PM", label: "Project Manager" },
      { value: "Engineer", label: "Engineer" },
    ];
    return isSuperAdmin
      ? [...base, { value: "Admin", label: "Admin" }]
      : base; // Admin cannot add Admins
  }, [isSuperAdmin]);

  const reset = () => {
    setFirstName(""); setLastName(""); setEmail("");
    setPhone(""); setGender(""); setRole("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(""); setOk("");

    // Guard: prevent Admin from trying to submit Admin role via devtools
    if (!isSuperAdmin && role === "Admin") {
      setErr("Only the SuperAdmin can add Admin users."); 
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setErr("Please enter first and last name."); return;
    }
    if (!email.trim()) {
      setErr("Please enter an email address."); return;
    }
    if (!role) {
      setErr("Please select a role."); return;
    }

    try {
      setLoading(true);
      await addUser({ firstName, lastName, email, phone, gender, role });
      setOk("Staff added successfully.");
      reset();
      // Small delay so user can see success
      setTimeout(() => navigate("/staffs"), 800);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to add staff.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Add New Staff</h1>
          <p className="mt-1 text-sm text-gray-600">
            {isSuperAdmin ? (
              <>As <span className="font-medium">SuperAdmin</span>, you can add Admin, PM, or Engineer.</>
            ) : (
              <>As <span className="font-medium">Admin</span>, you can add PM or Engineer.</>
            )}
          </p>
        </header>

        {/* Alerts */}
        {err && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {err}
          </div>
        )}
        {ok && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {ok}
          </div>
        )}

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-gray-200 bg-white shadow-md p-6"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First Name" value={firstName} onChange={setFirstName} required />
            <Field label="Last Name"  value={lastName}  onChange={setLastName}  required />
          </div>

          <Field label="Email" type="email" value={email} onChange={setEmail} required />
          <Field label="Phone" type="tel" value={phone} onChange={setPhone} placeholder="+1 555 000 1234" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Gender"
              value={gender}
              onChange={setGender}
              options={[
                { value: "", label: "Select…" },
                { value: "Male", label: "Male" },
                { value: "Female", label: "Female" },
                { value: "Other", label: "Other" },
              ]}
            />
            <Select
              label="Role"
              value={role}
              onChange={setRole}
              required
              options={roleOptions}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-900 disabled:opacity-50"
            >
              {loading ? "Adding…" : "Add Staff"}
            </button>

            <button
              type="button"
              onClick={reset}
              disabled={loading}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              Clear
            </button>

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="ml-auto rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Back
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

/* ---------- UI helpers ---------- */
function Field({ label, value, onChange, type = "text", required = false, placeholder = "" }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">
        {label}{required && " *"}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-black focus:ring-black"
      />
    </div>
  );
}

function Select({ label, value, onChange, options = [], required = false }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">
        {label}{required && " *"}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-black focus:ring-black"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
