import { Resend } from "resend";
import {
  Notification,
  NotificationContentType,
} from "../entities/Notification";

const resend = new Resend(process.env.RESEND_API_KEY);

// Brand tokens
const brand = {
  primary: "#2989e3",
  secondary: "#f02c89",
  tertiary: "#724498",
  success: "#2dd36f",
  text: "#1a1c1e",
  textMuted: "#43474e",
  textSubtle: "#73777f",
  surface: "#faf9fd",
  surfaceVariant: "#eeedf1",
  border: "#c3c6cf",
};

function baseLayout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DaylyBread</title>
</head>
<body style="margin:0; padding:0; background-color:#f0f2f5; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', 'Roboto', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${brand.primary} 0%, ${brand.tertiary} 100%); border-radius: 20px 20px 0 0; padding: 32px 40px; text-align: center;">
              <div style="display:inline-block;">
                <!-- Wordmark -->
                <span style="font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.7); display: block; margin-bottom: 4px;">✦ &nbsp; DaylyBread &nbsp; ✦</span>
                <span style="font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; display: block;">Your Daily Word</span>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 40px 32px; border-left: 1px solid ${brand.border}; border-right: 1px solid ${brand.border};">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: ${brand.surfaceVariant}; border-radius: 0 0 20px 20px; border: 1px solid ${brand.border}; border-top: none; padding: 24px 40px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 13px; color: ${brand.textSubtle};">
                You received this email because you're part of the DaylyBread community.
              </p>
              <p style="margin: 0; font-size: 13px; color: ${brand.textSubtle};">
                © ${new Date().getFullYear()} DaylyBread · <a href="https://daylybread.com" style="color: ${brand.primary}; text-decoration: none;">daylybread.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function ctaButton(href: string, label: string, color = brand.primary): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0;">
      <tr>
        <td style="border-radius: 14px; background-color: ${color};">
          <a href="${href}"
             style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 700;
                    color: #ffffff; text-decoration: none; border-radius: 14px; letter-spacing: 0.01em;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function divider(): string {
  return `<hr style="border: none; border-top: 1px solid ${brand.border}; margin: 28px 0;" />`;
}

export class EmailService {
  async sendNotificationEmail(
    userEmail: string,
    notification: Notification,
  ): Promise<void> {
    const htmlContent = this.getEmailTemplate(notification);

    const { error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || "DaylyBread <noreply@daylybread.com>",
      to: [userEmail],
      subject: notification.title,
      text: notification.message,
      html: htmlContent.html,
    });

    if (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  private getEmailTemplate(notification: Notification): { html: string } {
    const baseUrl = (
      process.env.FRONTEND_URL || "https://daylybread.com"
    ).replace(/\/$/, "");

    switch (notification.contentType) {
      case NotificationContentType.TEAM_INVITE:
        return {
          html: baseLayout(`
            <p style="margin: 0 0 6px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: ${brand.secondary};">Worship Team</p>
            <h1 style="margin: 0 0 16px; font-size: 26px; font-weight: 800; color: ${brand.text}; line-height: 1.2;">You've been invited! 🎶</h1>
            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: ${brand.textMuted};">
              ${notification.message}
            </p>

            ${divider()}

            <p style="margin: 0 0 4px; font-size: 13px; color: ${brand.textSubtle};">This invite expires in <strong style="color: ${brand.text};">7 days</strong>. Accept it before then to join the team.</p>

            ${ctaButton(notification.actionUrl || `${baseUrl}/worship`, notification.actionText || "View Invite", brand.secondary)}

            ${divider()}

            <p style="margin: 0; font-size: 13px; color: ${brand.textSubtle};">
              Don't have a DaylyBread account yet? The link above will guide you through creating one.
            </p>
          `),
        };

      case NotificationContentType.SERVICE_PUBLISHED: {
        const meta = notification.metadata || {};
        const serviceName: string = meta.serviceName || "an upcoming service";
        const serviceDate: string = meta.serviceDate || "";
        const teamName: string = meta.teamName || "";
        const actionLink = notification.actionUrl
          ? notification.actionUrl.startsWith("http")
            ? notification.actionUrl
            : `${baseUrl}${notification.actionUrl}`
          : `${baseUrl}/worship/services`;

        return {
          html: baseLayout(`
            <p style="margin: 0 0 6px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: ${brand.tertiary};">Worship Service</p>
            <h1 style="margin: 0 0 16px; font-size: 26px; font-weight: 800; color: ${brand.text}; line-height: 1.2;">You've been scheduled! 🎵</h1>
            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: ${brand.textMuted};">
              ${notification.message}
            </p>

            ${divider()}

            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 24px;">
              ${
                serviceName
                  ? `
              <tr>
                <td style="padding: 8px 0; font-size: 14px; color: ${brand.textSubtle}; width: 120px;">Service</td>
                <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: ${brand.text};">${serviceName}</td>
              </tr>`
                  : ""
              }
              ${
                serviceDate
                  ? `
              <tr>
                <td style="padding: 8px 0; font-size: 14px; color: ${brand.textSubtle}; width: 120px;">Date &amp; Time</td>
                <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: ${brand.text};">${serviceDate}</td>
              </tr>`
                  : ""
              }
              ${
                teamName
                  ? `
              <tr>
                <td style="padding: 8px 0; font-size: 14px; color: ${brand.textSubtle}; width: 120px;">Team</td>
                <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: ${brand.text};">${teamName}</td>
              </tr>`
                  : ""
              }
            </table>

            ${ctaButton(actionLink, notification.actionText || "View Service", brand.tertiary)}

            ${divider()}

            <p style="margin: 0; font-size: 13px; color: ${brand.textSubtle};">
              Please confirm your availability by accepting or declining your assignment in the app.
            </p>
          `),
        };
      }

      case NotificationContentType.MOOD_REQUEST_AVAILABLE:
        return {
          html: baseLayout(`
            <p style="margin: 0 0 6px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: ${brand.primary};">Mood Request</p>
            <h1 style="margin: 0 0 16px; font-size: 26px; font-weight: 800; color: ${brand.text}; line-height: 1.2;">Your verse is ready 🙏</h1>
            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: ${brand.textMuted};">
              ${notification.message}
            </p>
            ${ctaButton(`${baseUrl}/mood-request`, "Get Your Verse", brand.primary)}
            ${divider()}
            <p style="margin: 0; font-size: 13px; color: ${brand.textSubtle};">
              This was sent because you requested a verse based on your mood.
            </p>
          `),
        };

      case NotificationContentType.DAILY_VERSE:
        return {
          html: baseLayout(`
            <p style="margin: 0 0 6px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: ${brand.success};">Daily Verse</p>
            <h1 style="margin: 0 0 16px; font-size: 26px; font-weight: 800; color: ${brand.text}; line-height: 1.2;">Today's Word for You 📖</h1>
            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: ${brand.textMuted};">
              ${notification.message}
            </p>
            ${ctaButton(`${baseUrl}/daily-verse`, "Read Today's Verse", brand.success)}
          `),
        };

      default:
        return {
          html: baseLayout(`
            <h1 style="margin: 0 0 16px; font-size: 26px; font-weight: 800; color: ${brand.text}; line-height: 1.2;">
              ${notification.title}
            </h1>
            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: ${brand.textMuted};">
              ${notification.message}
            </p>
            ${
              notification.actionUrl
                ? ctaButton(
                    notification.actionUrl.startsWith("http")
                      ? notification.actionUrl
                      : `${baseUrl}${notification.actionUrl}`,
                    notification.actionText || "View",
                    brand.primary,
                  )
                : ""
            }
          `),
        };
    }
  }
}
