// Alternative email service using Nodemailer
import nodemailer from "nodemailer";
import {
  Notification,
  NotificationContentType,
} from "../entities/Notification";

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: "gmail", // or 'smtp' for custom SMTP
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD, // Use App Password for Gmail
      },
    });
  }

  async sendNotificationEmail(
    userEmail: string,
    notification: Notification
  ): Promise<void> {
    const htmlContent = this.getEmailTemplate(notification);

    const mailOptions = {
      from: process.env.FROM_EMAIL || "noreply@daylybread.com",
      to: userEmail,
      subject: notification.title,
      text: notification.message,
      html: htmlContent.html,
    };

    await this.transporter.sendMail(mailOptions);
  }

  private getEmailTemplate(notification: Notification): { html: string } {
    const baseUrl = process.env.FRONTEND_URL || "https://daylybread.com";

    switch (notification.contentType) {
      case NotificationContentType.MOOD_REQUEST_AVAILABLE:
        return {
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; background-color: #faf9fd; padding: 20px; border-radius: 12px;">
              <h2 style="color: #1a1c1e; margin-bottom: 16px;">Your Mood Request is Ready! 🙏</h2>
              <p style="color: #43474e; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">${notification.message}</p>
              <div style="margin: 20px 0;">
                <a href="${baseUrl}/mood-request" 
                   style="background-color: #0060a8; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 12px; display: inline-block; font-weight: 500;">
                  Get Your Verse
                </a>
              </div>
              <p style="color: #73777f; font-size: 14px; margin-top: 20px;">
                This notification was sent because you requested a verse for your mood.
              </p>
            </div>
          `,
        };

      case NotificationContentType.DAILY_VERSE:
        return {
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; background-color: #faf9fd; padding: 20px; border-radius: 12px;">
              <h2 style="color: #1a1c1e; margin-bottom: 16px;">Your Daily Verse 📖</h2>
              <p style="color: #43474e; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">${notification.message}</p>
              <div style="margin: 20px 0;">
                <a href="${baseUrl}/daily-verse" 
                   style="background-color: #2dd36f; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 12px; display: inline-block; font-weight: 500;">
                  Read Today's Verse
                </a>
              </div>
            </div>
          `,
        };

      default:
        return {
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; background-color: #faf9fd; padding: 20px; border-radius: 12px;">
              <h2 style="color: #1a1c1e; margin-bottom: 16px;">${
                notification.title
              }</h2>
              <p style="color: #43474e; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">${
                notification.message
              }</p>
              ${
                notification.actionUrl
                  ? `
                <div style="margin: 20px 0;">
                  <a href="${baseUrl}${notification.actionUrl}" 
                     style="background-color: #0060a8; color: white; padding: 12px 24px; 
                            text-decoration: none; border-radius: 12px; display: inline-block; font-weight: 500;">
                    ${notification.actionText || "View"}
                  </a>
                </div>
              `
                  : ""
              }
            </div>
          `,
        };
    }
  }
}
