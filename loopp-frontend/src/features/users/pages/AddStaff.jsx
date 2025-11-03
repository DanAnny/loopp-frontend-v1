// src/pages/AddStaff.jsx
import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { UserPlus, ArrowLeft, Trash2, Check, AlertCircle } from "lucide-react";
import { addUser } from "@/services/auth.service"; // named export

export default function AddStaff() {
  const navigate = useNavigate();

  // Current logged-in user from Redux
  const me = useSelector((s) => s.auth?.user);
  const myRole = (me?.role || "").toString();
  const isSuperAdmin = /superadmin/i.test(myRole);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]         = useState("");
  const [phone, setPhone]         = useState("");
  const [gender, setGender]       = useState("");
  const [role, setRole]           = useState(""); // PM | Engineer | Admin (shown only if SuperAdmin)

  // UI state
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");
  const [ok, setOk]           = useState("");

  const roleOptions = useMemo(() => {
    const base = [
      { value: "", label: "Select Role…" },
      { value: "PM", label: "Project Manager" },
      { value: "Engineer", label: "Engineer" },
    ];
    return isSuperAdmin ? [...base, { value: "Admin", label: "Admin" }] : base; // Admin cannot add Admins
  }, [isSuperAdmin]);

  const reset = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setGender("");
    setRole("");
    setErr("");
    setOk("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setOk("");

    // Guard: prevent Admin from trying to submit Admin role via devtools
    if (!isSuperAdmin && role === "Admin") {
      setErr("Only the SuperAdmin can add Admin users.");
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setErr("Please enter first and last name.");
      return;
    }
    if (!email.trim()) {
      setErr("Please enter an email address.");
      return;
    }
    if (!role) {
      setErr("Please select a role.");
      return;
    }

    try {
      setLoading(true);
      await addUser({ firstName, lastName, email, phone, gender, role });
      setOk("Staff added successfully.");
      reset();
      // Small delay so user can see success
      setTimeout(() => navigate("/staffs"), 800);
    } catch (e2) {
      setErr(e2?.response?.data?.message || e2?.message || "Failed to add staff.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0f1729] px-6 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl text-white">Add New Staff</h1>
              <p className="text-sm text-slate-400 mt-1">
                {isSuperAdmin ? (
                  <>
                    As <span className="text-purple-400 font-medium">SuperAdmin</span>, you can add Admin, PM, or Engineer.
                  </>
                ) : (
                  <>
                    As <span className="text-blue-400 font-medium">Admin</span>, you can add PM or Engineer.
                  </>
                )}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Alerts */}
        {err && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {err}
          </motion.div>
        )}
        {ok && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 flex items-center gap-2"
          >
            <Check className="w-4 h-4 flex-shrink-0" />
            {ok}
          </motion.div>
        )}

        {/* Form Card */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-700/50 bg-[#1a2332] shadow-xl p-8"
        >
          <div className="space-y-6">
            {/* Name Fields */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="First Name" value={firstName} onChange={setFirstName} required placeholder="John" />
              <Field label="Last Name" value={lastName} onChange={setLastName} required placeholder="Doe" />
            </div>

            {/* Email */}
            <Field label="Email" type="email" value={email} onChange={setEmail} required placeholder="john.doe@company.com" />

            {/* Phone */}
            <Field label="Phone" type="tel" value={phone} onChange={setPhone} placeholder="+1 555 000 1234" />

            {/* Gender & Role */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
              <Select label="Role" value={role} onChange={setRole} required options={roleOptions} />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-700/50">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 shadow-lg"
              >
                <UserPlus className="w-4 h-4" />
                {loading ? "Adding…" : "Add Staff"}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={reset}
                disabled={loading}
                className="bg-[#1f2937] text-white px-6 py-2.5 rounded-lg text-sm font-medium border border-slate-700/50 hover:bg-[#252f3f] transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => navigate(-1)}
                className="ml-auto bg-[#1f2937] text-white px-6 py-2.5 rounded-lg text-sm font-medium border border-slate-700/50 hover:bg-[#252f3f] transition-all inline-flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </motion.button>
            </div>
          </div>
        </motion.form>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 rounded-xl border border-slate-700/50 bg-[#1a2332] p-5"
        >
          <h3 className="text-sm text-white mb-2">Role Permissions</h3>
          <ul className="space-y-2 text-xs text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-purple-400">•</span>
              <span>
                <strong className="text-slate-300">Project Manager:</strong> Can manage projects, assign tasks, and track progress
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400">•</span>
              <span>
                <strong className="text-slate-300">Engineer:</strong> Can work on assigned tasks and update their status
              </span>
            </li>
            {isSuperAdmin && (
              <li className="flex items-start gap-2">
                <span className="text-pink-400">•</span>
                <span>
                  <strong className="text-slate-300">Admin:</strong> Can add PMs and Engineers, manage organization settings
                </span>
              </li>
            )}
          </ul>
        </motion.div>
      </div>
    </main>
  );
}

/* ---------- UI helpers ---------- */
function Field({ label, value, onChange, type = "text", required = false, placeholder = "" }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-700/50 bg-[#0f1729] text-white px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
      />
    </div>
  );
}

function Select({ label, value, onChange, options = [], required = false }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-lg border border-slate-700/50 bg-[#0f1729] text-white px-4 py-2.5 text-sm focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
