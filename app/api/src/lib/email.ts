import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_KEY);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendEmail(
  from: string,
  to: string,
  subject: string,
  html: string,
) {
  try {
    const { data, error } = await resend.emails.send({
      from: from,
      to: to,
      subject: subject,
      html: html,
    });
    if (error) {
      console.error("Error sending email:", error);
      return;
    }
    return data;
  } catch (error) {
    console.error("Error sending email:", error);
    return;
  }
}

type CurrentEmailOptions = {
  title: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  body: string;
  cta?: {
    label: string;
    url: string;
  };
  note?: string;
  linkHelp?: string;
};

function currentEmailHtml({
  title,
  preheader,
  eyebrow,
  heading,
  body,
  cta,
  note,
  linkHelp,
}: CurrentEmailOptions) {
  const safeTitle = escapeHtml(title);
  const safePreheader = escapeHtml(preheader);
  const safeEyebrow = escapeHtml(eyebrow);
  const safeHeading = escapeHtml(heading);
  const safeBody = escapeHtml(body);
  const safeNote = note ? escapeHtml(note) : "";
  const safeCtaUrl = cta ? escapeHtml(cta.url) : "";
  const safeCtaLabel = cta ? escapeHtml(cta.label) : "";
  const safeLinkHelp = linkHelp ? escapeHtml(linkHelp) : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${safeTitle}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet" />
  </head>
  <body style="margin:0;padding:0;background:#07090F;color:#ffffff;font-family:'Plus Jakarta Sans',system-ui,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${safePreheader}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07090F;margin:0;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0C1018;border:1px solid rgba(255,255,255,0.07);border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 24px;background:#0C1018;background-image:radial-gradient(ellipse 80% 60% at 0% 0%,rgba(75,159,255,0.11),transparent);">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:32px;height:32px;border-radius:8px;background:#4B9FFF;color:#07090F;text-align:center;font-size:17px;font-weight:800;line-height:32px;">C</td>
                          <td style="padding-left:10px;color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.3px;">Current</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:32px;">
                      <p style="margin:0 0 10px;color:#4B9FFF;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${safeEyebrow}</p>
                      <h1 style="margin:0;color:#ffffff;font-size:30px;line-height:1.1;font-weight:800;letter-spacing:-0.5px;">${safeHeading}</h1>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="height:1px;background:rgba(255,255,255,0.07);font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:28px 32px 32px;background:#111722;">
                <p style="margin:0;color:rgba(255,255,255,0.66);font-size:15px;line-height:1.7;font-weight:500;">
                  ${safeBody}
                </p>
                ${
                  cta
                    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 24px;">
                  <tr>
                    <td style="border-radius:999px;background:#4B9FFF;">
                      <a href="${safeCtaUrl}" style="display:inline-block;padding:14px 26px;color:#07090F;text-decoration:none;font-size:14px;font-weight:700;border-radius:999px;">${safeCtaLabel}</a>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(75,159,255,0.07);border:1px solid rgba(75,159,255,0.18);border-radius:14px;">
                  <tr>
                    <td style="padding:14px 16px;">
                      <p style="margin:0;color:rgba(255,255,255,0.44);font-size:12px;line-height:1.55;font-weight:500;">
                        ${safeLinkHelp || "If the button does not work, paste this link into your browser:"}
                      </p>
                      <p style="margin:8px 0 0;color:#4B9FFF;font-size:12px;line-height:1.5;font-weight:600;word-break:break-all;">
                        <a href="${safeCtaUrl}" style="color:#4B9FFF;text-decoration:none;">${safeCtaUrl}</a>
                      </p>
                    </td>
                  </tr>
                </table>`
                    : ""
                }
                ${
                  safeNote
                    ? `<p style="margin:24px 0 0;color:rgba(255,255,255,0.30);font-size:13px;line-height:1.65;font-weight:500;">
                  ${safeNote}
                </p>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 22px;border-top:1px solid rgba(255,255,255,0.07);background:#0C1018;">
                <p style="margin:0;color:rgba(255,255,255,0.22);font-size:12px;line-height:1.5;font-weight:500;">
                  Current &middot; Bank-grade encryption
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendPasswordResetEmail(email: string, url: string) {
  const html = currentEmailHtml({
    title: "Reset your Current password",
    preheader: "Reset your Current password. This link expires soon.",
    eyebrow: "Password reset",
    heading: "Reset your password",
    body: "We received a request to reset the password for your Current account. Use the button below to choose a new password.",
    cta: {
      label: "Reset password",
      url,
    },
    note: "If you did not request this, you can safely ignore this email. Your password will stay the same.",
  });

  return sendEmail(
    process.env.RESEND_FROM ?? "Current <current@chickengfx.xyz>>",
    email,
    "Reset your Current password",
    html,
  );
}

export const passwordResetNotificationEmail = async (email: string) => {
  const html = currentEmailHtml({
    title: "Your Current password was reset",
    preheader: "Your Current password was just changed.",
    eyebrow: "Security notice",
    heading: "Your password was reset",
    body: "This is a confirmation that the password for your Current account was changed. If this was you, no further action is needed.",
    note: "If you did not reset your password, secure your account right away or contact Current support.",
  });

  return sendEmail(
    process.env.RESEND_FROM ?? "Current <current@chickengfx.xyz>>",
    email,
    "Your Current password was reset",
    html,
  );
};


export const emailVerificationEmail = async (email: string, url: string) => {
  const html = currentEmailHtml({
    title: "Verify your Current email",
    preheader: "Confirm your email address to finish setting up Current.",
    eyebrow: "Email verification",
    heading: "Verify your email",
    body: "Confirm this email address so Current can keep your account secure and send important account updates.",
    cta: {
      label: "Verify email",
      url,
    },
    note: "If you did not create a Current account, you can safely ignore this email.",
  });

  return sendEmail(
    process.env.RESEND_FROM ?? "Current <current@chickengfx.xyz>>",
    email,
    "Verify your Current email",
    html,
  );
};