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
      from: process.env.FROM_EMAIL || "noreply@dailybread.com",
      to: userEmail,
      subject: notification.title,
      text: notification.message,
      html: htmlContent.html,
    };

    await this.transporter.sendMail(mailOptions);
  }

  private getEmailTemplate(notification: Notification): { html: string } {
    const baseUrl = process.env.FRONTEND_URL || "https://dailybread.com";

    switch (notification.contentType) {
      case NotificationContentType.MOOD_REQUEST_AVAILABLE:
        return {
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4a5568;">Your Mood Request is Ready! 🙏</h2>
              <p style="color: #2d3748; font-size: 16px;">${notification.message}</p>
              <div style="margin: 20px 0;">
                <a href="${baseUrl}/mood-request" 
                   style="background-color: #4299e1; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px; display: inline-block;">
                  Get Your Verse
                </a>
              </div>
              <p style="color: #718096; font-size: 14px;">
                This notification was sent because you requested a verse for your mood.
              </p>
            </div>
          `,
        };

      case NotificationContentType.DAILY_VERSE:
        return {
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4a5568;">Your Daily Verse 📖</h2>
              <p style="color: #2d3748; font-size: 16px;">${notification.message}</p>
              <div style="margin: 20px 0;">
                <a href="${baseUrl}/daily-verse" 
                   style="background-color: #48bb78; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px; display: inline-block;">
                  Read Today's Verse
                </a>
              </div>
            </div>
          `,
        };

      default:
        return {
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4a5568;">${notification.title}</h2>
              <p style="color: #2d3748; font-size: 16px;">${
                notification.message
              }</p>
              ${
                notification.actionUrl
                  ? `
                <div style="margin: 20px 0;">
                  <a href="${baseUrl}${notification.actionUrl}" 
                     style="background-color: #4299e1; color: white; padding: 12px 24px; 
                            text-decoration: none; border-radius: 6px; display: inline-block;">
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
