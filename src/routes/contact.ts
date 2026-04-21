import type { FastifyPluginAsync } from "fastify";
import rateLimit from "@fastify/rate-limit";
import nodemailer from "nodemailer";

interface ContactPayload {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  company?: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const contactRoute: FastifyPluginAsync = async (app) => {
  await app.register(rateLimit, {
    max: 5,
    timeWindow: "1 minute",
  });

  app.post<{ Body: ContactPayload }>("/contact", async (request, reply) => {
    const payload = request.body ?? {};

    const name = payload.name?.trim() ?? "";
    const email = payload.email?.trim() ?? "";
    const subject = payload.subject?.trim() ?? "";
    const message = payload.message?.trim() ?? "";
    const honeypot = payload.company?.trim() ?? "";

    if (honeypot) {
      return { ok: true };
    }

    if (!name || !email || !message) {
      return reply
        .status(400)
        .send({ error: "Name, email, and message are required." });
    }

    if (!isValidEmail(email)) {
      return reply
        .status(400)
        .send({ error: "Please provide a valid email address." });
    }

    if (message.length > 5000) {
      return reply
        .status(400)
        .send({ error: "Message is too long (max 5000 characters)." });
    }

    const {
      BREVO_SMTP_HOST,
      BREVO_SMTP_PORT,
      BREVO_SMTP_USER,
      BREVO_SMTP_PASS,
      CONTACT_FROM_EMAIL,
      CONTACT_FROM_NAME,
      CONTACT_TO_EMAIL,
    } = process.env;

    if (
      !BREVO_SMTP_HOST ||
      !BREVO_SMTP_PORT ||
      !BREVO_SMTP_USER ||
      !BREVO_SMTP_PASS ||
      !CONTACT_FROM_EMAIL ||
      !CONTACT_TO_EMAIL
    ) {
      app.log.error("Missing SMTP environment variables.");
      return reply.status(500).send({ error: "Email service is not configured." });
    }

    const port = Number(BREVO_SMTP_PORT);
    const transporter = nodemailer.createTransport({
      host: BREVO_SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: BREVO_SMTP_USER, pass: BREVO_SMTP_PASS },
    });

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject || "New portfolio contact");
    const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");

    try {
      await transporter.sendMail({
        from: {
          name: CONTACT_FROM_NAME || "Portfolio Contact",
          address: CONTACT_FROM_EMAIL,
        },
        to: CONTACT_TO_EMAIL,
        replyTo: { name, address: email },
        subject: subject ? `[Portfolio] ${subject}` : "[Portfolio] New message",
        text: `Name: ${name}\nEmail: ${email}\nSubject: ${
          subject || "(none)"
        }\n\n${message}`,
        html: `
          <div style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.6;">
            <h2 style="margin:0 0 16px;color:#111;">New portfolio message</h2>
            <p><strong>Name:</strong> ${safeName}</p>
            <p><strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
            <p><strong>Subject:</strong> ${safeSubject}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
            <p>${safeMessage}</p>
          </div>
        `,
      });

      return { ok: true };
    } catch (error) {
      app.log.error({ err: error }, "Failed to send contact email");
      return reply
        .status(502)
        .send({ error: "Failed to send message. Please try again later." });
    }
  });
};
