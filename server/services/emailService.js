import nodemailer from "nodemailer";

let testEmailSender = null;

const requiredEmailSettings = ["EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASS"];

export const getEmailConfiguration = () => {
  const missing = requiredEmailSettings.filter((name) => !String(process.env[name] || "").trim());
  if (missing.length) {
    const error = new Error(`Email delivery is not configured: ${missing.join(", ")}`);
    error.code = "EMAIL_CONFIGURATION_MISSING";
    throw error;
  }

  const port = Number(process.env.EMAIL_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    const error = new Error("EMAIL_PORT must be a valid SMTP port.");
    error.code = "EMAIL_CONFIGURATION_INVALID";
    throw error;
  }

  const configuredSecure = String(process.env.EMAIL_SECURE || "").trim().toLowerCase();
  if (configuredSecure && !["true", "false"].includes(configuredSecure)) {
    const error = new Error("EMAIL_SECURE must be true or false when configured.");
    error.code = "EMAIL_CONFIGURATION_INVALID";
    throw error;
  }

  return {
    host: String(process.env.EMAIL_HOST).trim(),
    port,
    secure: configuredSecure ? configuredSecure === "true" : port === 465,
    user: String(process.env.EMAIL_USER).trim(),
    pass: String(process.env.EMAIL_PASS),
    from: String(process.env.EMAIL_FROM || process.env.EMAIL_USER).trim(),
  };
};

// Tests inject an in-memory sender, so they never open an SMTP connection or
// deliver mail. This setter is deliberately not used by application routes.
export const setEmailSenderForTests = (sender) => {
  testEmailSender = sender;
};

export const sendEmail = async ({ to, subject, html, text }) => {
  if (testEmailSender) return testEmailSender({ to, subject, html, text });
  const config = getEmailConfiguration();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
  await transporter.sendMail({
    from: config.from,
    to,
    subject,
    html,
    text,
  });
};
