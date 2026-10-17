const nodemailer = require("nodemailer");

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
const NAVY = "#0d1421";

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  try {
    const b = req.body || {};
    const name = String(b.name || "").trim().slice(0, 100);
    const email = String(b.email || "").trim().slice(0, 200);
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !Array.isArray(b.sections)) {
      return res.status(400).json({ ok: false, error: "Invalid submission" });
    }
    const { GMAIL_USER, GMAIL_APP_PASSWORD, COACH_EMAIL, COACH_WHATSAPP } = process.env;
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return res.status(500).json({ ok: false, error: "Email not configured" });
    const coach = COACH_EMAIL || GMAIL_USER;
    const first = esc(name.split(" ")[0]);
    const skip = !!b.skip;

    const tx = nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } });

    const attachments = [];
    const safe = name.replace(/[^\w]+/g, "_");
    for (const k of ["front", "left", "right", "back"]) {
      const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec((b.photos || {})[k] || "");
      if (m) attachments.push({ filename: `${safe}_${k}.jpg`, content: Buffer.from(m[1], "base64"), contentType: "image/jpeg" });
    }

    const rows = b.sections.slice(0, 12).map((s) =>
      `<h3 style="margin:24px 0 8px;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#2f4466">${esc(s.t)}</h3>
       <table style="width:100%;border-collapse:collapse;font-size:14px">${(s.rows || []).slice(0, 40).map((r) =>
        `<tr><td style="padding:7px 10px 7px 0;border-top:1px solid #e3e9f1;color:#5b6a80;width:38%;vertical-align:top">${esc(r[0])}</td><td style="padding:7px 0;border-top:1px solid #e3e9f1;vertical-align:top">${esc(r[1])}</td></tr>`).join("")}</table>`
    ).join("");

    const photoNote = skip
      ? "No photos were uploaded. The client chose to send them privately on WhatsApp."
      : `${attachments.length} progress photo(s) attached.`;

    await tx.sendMail({
      from: `"Onboarding Form" <${GMAIL_USER}>`,
      to: coach,
      replyTo: email,
      subject: `New onboarding: ${name}${b.goal ? " · " + String(b.goal).slice(0, 40) : ""}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:${NAVY}">
        <div style="background:${NAVY};color:#fff;padding:22px 24px;border-radius:10px 10px 0 0"><div style="font-size:12px;letter-spacing:2px;color:#9fb4d0">NEW CLIENT ONBOARDING</div><div style="font-size:22px;font-weight:600;margin-top:6px">${esc(name)}</div></div>
        <div style="padding:8px 24px 24px;border:1px solid #e3e9f1;border-top:0;border-radius:0 0 10px 10px">
        <p style="font-size:13px;color:#5b6a80">${esc(photoNote)} Reply to this email to reach the client.</p>${rows}</div></div>`,
      attachments,
    });

    try {
      const wa = COACH_WHATSAPP ? ` or send them on WhatsApp at ${esc(COACH_WHATSAPP)}` : "";
      await tx.sendMail({
        from: `"Kali Srivastava" <${GMAIL_USER}>`,
        to: email,
        replyTo: coach,
        subject: `You're in, ${name.split(" ")[0]}. Your onboarding is complete`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:${NAVY};line-height:1.6">
          <div style="background:${NAVY};color:#fff;padding:26px 28px;border-radius:10px 10px 0 0"><div style="font-size:12px;letter-spacing:2px;color:#9fb4d0">HANDLED BY KALI SRIVASTAVA</div><div style="font-size:22px;font-weight:600;margin-top:8px">Onboarding complete</div></div>
          <div style="padding:24px 28px;border:1px solid #e3e9f1;border-top:0;border-radius:0 0 10px 10px">
          <p>Hi ${first},</p>
          <p>Thank you for completing your onboarding. I've received your goals, food preferences, daily schedule and details, and I'll use them to build a plan that fits your life.</p>
          ${skip
            ? `<p><strong>One last step:</strong> please reply to this email with your four starting photos (front, left side, right side and back)${wa}. Fitted clothing, good lighting and the camera at waist height work best.</p>`
            : `<p>Your four starting photos have also reached me safely.</p>`}
          <p><strong>Your privacy:</strong> your photos and answers are seen only by me. They are used only to build your plan and track your progress, they are never shared or posted anywhere, and you can ask me to delete them at any time.</p>
          <p><strong>What happens next:</strong> I'll review everything personally and get in touch with your next steps. If you have a question in the meantime, just reply to this email.</p>
          <p style="margin-top:24px">Warm regards,<br>Kali Srivastava<br><span style="color:#5b6a80">Fitness Coach</span></p></div></div>`,
      });
    } catch (e) {
      console.error("Client confirmation failed", e);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false });
  }
};
