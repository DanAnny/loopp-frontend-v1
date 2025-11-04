// src/services/email.service.js
import nodemailer from "nodemailer";
import { config } from "../config/env.js";

/* ---------------------------- transport builder ---------------------------- */

function normalizeFrom(v) {
  // If already looks like `Name <email@domain>`, keep it.
  if (/<.+>/.test(String(v || ""))) return v;
  // Otherwise treat as raw email and brand it.
  const email = String(v || "no-reply@localhost").trim();
  return `Loopp AI <${email}>`;
}

const enabled = !!config?.smtp?.enabled;
const host = config?.smtp?.host || "smtp-relay.brevo.com";
const port = Number(config?.smtp?.port || 587);
const user = config?.smtp?.user;
const pass = config?.smtp?.pass;
const from = normalizeFrom(config?.smtp?.mailFrom);

let transport = null;

if (enabled && host && port && user && pass) {
  transport = nodemailer.createTransport({
    host,
    port,
    secure: String(port) === "465",
    requireTLS: String(port) !== "465",
    auth: { user, pass },
    tls: { minVersion: "TLSv1.2" },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });

  transport.verify()
    .then(() => console.log("[mailer] ✅ transport ready (Brevo SMTP verified)"))
    .catch(err => console.warn("[mailer] ❗ verify failed:", err?.message));
} else {
  console.warn("[mailer] (disabled) Set SMTP_ENABLED=true and all SMTP_* envs to send email.");
}

async function safeSend({ to, subject, html, text }) {
  if (!transport) {
    console.log("[mailer] (disabled) would send →", { to, subject });
    return { queued: false, disabled: true };
  }
  const payload = {
    from,
    to,
    subject,
    text: text || stripHtml(html || ""),
    html: html || (text ? `<pre>${escapeHtml(text)}</pre>` : "<p>(no content)</p>"),
  };
  try {
    const info = await transport.sendMail(payload);
    console.log("[mailer] sent:", { to, subject, messageId: info.messageId });
    return { queued: true, messageId: info.messageId };
  } catch (e) {
    console.error("[mailer] send failed:", e?.message);
    return { queued: false, error: e?.message || "send failed" };
  }
}

function stripHtml(s = "") {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function escapeHtml(s = "") {
  return s.replace(/[&<>'"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
}

/* ----------------------------- email templates ----------------------------- */

function clientNewRequestSubject(req) {
  return `We received your request: ${req.projectTitle || "New project"}`;
}
function clientNewRequestHtml(req) {
  const title = req.projectTitle || "New project";
  const name = `${req.firstName || ""} ${req.lastName || ""}`.trim() || "there";
  const due = req.completionDate ? new Date(req.completionDate).toDateString() : "—";
  return `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6">
      <h2>Thanks ${name}, we’ve got your request ✅</h2>
      <p><strong>Title:</strong> ${title}</p>
      <p><strong>Target date:</strong> ${due}</p>
      <p>We’re assigning a Project Manager and will follow up in your chat room.</p>
      <hr/><p>— Team Loopp</p>
    </div>`;
}

function adminsNewRequestSubject(req) {
  return `New request: ${req.projectTitle || "Untitled"} — ${(req.firstName || "")} ${(req.lastName || "")}`.trim();
}
function adminsNewRequestHtml(req) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6">
      <h3>New Project Request</h3>
      <ul>
        <li><strong>Client:</strong> ${req.firstName || ""} ${req.lastName || ""} (${req.email || "n/a"})</li>
        <li><strong>Title:</strong> ${req.projectTitle || "Untitled"}</li>
        <li><strong>Target date:</strong> ${req.completionDate || "—"}</li>
        <li><strong>Request ID:</strong> ${req._id}</li>
      </ul>
      <p>Open in Admin → /admin/projects/${req._id}</p>
    </div>`;
}

function pmsBroadcastSubject(req) {
  return `New client request available: ${req.projectTitle || "Project"}`;
}
function pmsBroadcastHtml(req) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6">
      <h3>New Request Available</h3>
      <p><strong>${req.firstName || ""} ${req.lastName || ""}</strong> submitted “${req.projectTitle || "Project"}”.</p>
      <p>Join the room to assist if you’re available.</p>
      <p>Request ID: ${req._id}</p>
    </div>`;
}

function clientThankYouSubject() {
  return "Thanks! Your project is complete";
}
function clientThankYouHtml(req) {
  const title = req.projectTitle || "your project";
  return `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6">
      <h2>Project completed 🎉</h2>
      <p>Thanks for working with us. We’ve marked <strong>${title}</strong> as complete.</p>
      <p>You can reply to this email for follow-ups, or request a reopen in chat.</p>
      <hr/><p>— Team Loopp</p>
    </div>`;
}

/* --------------------------------- exports --------------------------------- */

export async function emailClientNewRequest(req) {
  if (!req?.email) return { skipped: true };
  return safeSend({
    to: req.email,
    subject: clientNewRequestSubject(req),
    html: clientNewRequestHtml(req),
  });
}

export async function emailSuperAdminsNewRequest(req, superAdmins = []) {
  const toList = superAdmins.map(a => a.email).filter(Boolean);
  if (!toList.length) return { skipped: true };
  return safeSend({
    to: toList,
    subject: adminsNewRequestSubject(req),
    html: adminsNewRequestHtml(req),
  });
}

export async function emailPMsBroadcastNewRequest(req, pmEmails = []) {
  const toList = pmEmails.filter(Boolean);
  if (!toList.length) return { skipped: true };
  // BCC to avoid reply-all
  return safeSend({
    to: toList[0],
    bcc: toList.slice(1),
    subject: pmsBroadcastSubject(req),
    html: pmsBroadcastHtml(req),
  });
}

export async function emailClientThankYou(req) {
  if (!req?.email) return { skipped: true };
  return safeSend({
    to: req.email,
    subject: clientThankYouSubject(req),
    html: clientThankYouHtml(req),
  });
}
