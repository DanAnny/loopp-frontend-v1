import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { getIO } from "../lib/io.js";
import { sendMail as sendEmail } from "../lib/mailer.js";
import { emailNotifyUser } from "./email.service.js";

export const links = {
  chat: () => "/chat",
  chatRoom: (_roomId) => "/chat",      // route list, not /chat/room/:id
  engineerTask: (_requestId) => "/tasks",
  adminProject: (_requestId) => "",    // SA doesn’t navigate
};

/** Events that already have rich HTML emails in email.service.js */
const RICH_EMAIL_TYPES = new Set([
  "PM_ASSIGNED",            // PM assigned to client (rich to PMs/SAs)
  "ENGINEER_ASSIGNED",      // new: rich to PMs/SAs + client (client via dedicated fn)
  "ENGINEER_ACCEPTED",      // rich to PMs/SAs + client
  "STATUS_REVIEW",          // new: rich to PMs/SAs + client
  "PROJECT_COMPLETED",      // client gets rich thank-you
  "PROJECT_REOPENED",       // new: client gets rich “room reopened”
  "CLIENT_RATED",           // keep mirror for staff only (no rich client email)
]);

/**
 * Upsert a notification, emit over socket, and mirror as email.
 * Ensures a single (user,type,requestId,taskId) entry by unique index.
 */
export async function createAndEmit(userId, payload) {
  const filter = { user: userId, type: payload.type };
  if (payload?.meta?.requestId) filter["meta.requestId"] = payload.meta.requestId;
  if (payload?.meta?.taskId)    filter["meta.taskId"]    = payload.meta.taskId;

  const update = {
    $setOnInsert: {
      user: userId,
      type: payload.type,
      title: payload.title,
      body: payload.body || "",
      link: payload.link || "",
      meta: payload.meta || {},
    },
  };

  const doc = await Notification.findOneAndUpdate(filter, update, {
    new: true, upsert: true, setDefaultsOnInsert: true,
  }).lean();

  // socket
  try { getIO()?.to(`user:${userId.toString()}`).emit("notify:event", doc); } catch {}

  // ✉️ Email mirror — suppress for events that have rich HTML emails to avoid “single-line” duplicates
  try {
    if (!RICH_EMAIL_TYPES.has(payload.type)) {
      const u = await User.findById(userId).lean();
      if (u?.email && !/client/i.test(String(u.role || ""))) {
        const subject = payload.title || "Notification";
        await emailNotifyUser(u.email, subject, payload.body || "", payload.link || "");
      }
    }
  } catch {}

  return doc;
}

export async function notifySuperAdmins(payload) {
  const superAdmins = await User.find({ role: { $in: ["SuperAdmin", "Admin", "superAdmin"] } }, "_id email").lean();
  const results = [];
  for (const sa of superAdmins) {
    results.push(await createAndEmit(sa._id, { ...payload, link: "" }));
  }
  return results;
}
