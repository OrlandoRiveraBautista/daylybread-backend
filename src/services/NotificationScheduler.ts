import { EntityManager, ObjectId } from "@mikro-orm/mongodb";
import { PubSubEngine } from "graphql-subscriptions";
import {
  Notification,
  UserNotificationSettings,
  NotificationStatus,
  NotificationDeliveryType,
  NotificationContentType,
} from "../entities/Notification";
import { NotificationResolver } from "../resolvers/NotificationResolver";
import { User } from "../entities/User";
// Email service imports
import sgMail from "@sendgrid/mail";
// Push notification imports
import webpush from "web-push";

export class NotificationScheduler {
  private em: EntityManager;
  private pubSub: PubSubEngine;
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(em: EntityManager, pubSub: PubSubEngine) {
    this.em = em;
    this.pubSub = pubSub;

    // Initialize email service
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }

    // Initialize push notifications
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || "mailto:your-email@example.com",
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
    }
  }

  // Start the notification scheduler
  public start(intervalMs: number = 60000): void {
    // Check every minute by default
    if (this.isRunning) {
      console.log("Notification scheduler is already running");
      return;
    }

    this.isRunning = true;
    console.log("Starting notification scheduler...");

    this.checkInterval = setInterval(async () => {
      await this.processNotifications();
    }, intervalMs);

    // Also run immediately on start
    this.processNotifications();
  }

  // Stop the notification scheduler
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log("Notification scheduler stopped");
  }

  // Process pending notifications that are due
  private async processNotifications(): Promise<void> {
    try {
      const now = new Date();

      // Find all pending notifications that are due
      const dueNotifications = await this.em.find(Notification, {
        status: NotificationStatus.PENDING,
        scheduledFor: { $lte: now },
      });

      console.log(`Processing ${dueNotifications.length} due notifications`);

      for (const notification of dueNotifications) {
        await this.sendNotification(notification);
      }
    } catch (error) {
      console.error("Error processing notifications:", error);
    }
  }

  // Send a specific notification
  private async sendNotification(notification: Notification): Promise<void> {
    try {
      // Get user's notification settings
      const userSettings = await this.em.findOne(UserNotificationSettings, {
        userId: notification.userId,
      });

      let notificationSent = false;

      // Check content type permissions first
      const contentTypeAllowed = this.isContentTypeAllowed(
        notification.contentType,
        userSettings
      );
      if (!contentTypeAllowed) {
        notification.status = NotificationStatus.FAILED;
        notification.errorMessage = `User has disabled ${notification.contentType} notifications`;
        await this.em.persistAndFlush(notification);
        return;
      }

      switch (notification.deliveryType) {
        case NotificationDeliveryType.WEBSOCKET:
          if (!userSettings || userSettings.enableWebSocketNotifications) {
            await this.sendWebSocketNotification(notification);
            notificationSent = true;
          }
          break;

        case NotificationDeliveryType.BROWSER_PUSH:
          if (userSettings && userSettings.enableBrowserPushNotifications) {
            await this.sendBrowserPushNotification(notification, userSettings);
            notificationSent = true;
          }
          break;

        case NotificationDeliveryType.EMAIL:
          if (userSettings && userSettings.enableEmailNotifications) {
            await this.sendEmailNotification(notification);
            notificationSent = true;
          }
          break;

        case NotificationDeliveryType.IN_APP:
          if (!userSettings || userSettings.enableInAppNotifications) {
            await this.sendInAppNotification(notification);
            notificationSent = true;
          }
          break;

        default:
          console.warn(
            `Unknown notification delivery type: ${notification.deliveryType}`
          );
      }

      // Update notification status
      if (notificationSent) {
        notification.status = NotificationStatus.SENT;
        notification.sentAt = new Date();
        console.log(
          `Sent ${notification.deliveryType} notification (${notification.contentType}) to user: ${notification.userId}`
        );
      } else {
        notification.status = NotificationStatus.FAILED;
        notification.errorMessage = `User has disabled ${notification.deliveryType} notifications`;
        console.log(
          `Skipped ${notification.deliveryType} notification (disabled by user) for ${notification.contentType} to user: ${notification.userId}`
        );
      }

      await this.em.persistAndFlush(notification);
    } catch (error) {
      console.error(`Error sending notification ${notification._id}:`, error);

      // Mark as failed
      notification.status = NotificationStatus.FAILED;
      notification.errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await this.em.persistAndFlush(notification);
    }
  }

  // Send WebSocket notification
  private async sendWebSocketNotification(
    notification: Notification
  ): Promise<void> {
    const message = notification.message;
    const mood = notification.metadata?.mood || "unknown";

    await NotificationResolver.sendWebSocketNotification(
      this.pubSub,
      notification.userId,
      mood,
      message
    );
  }

  // Send browser push notification
  private async sendBrowserPushNotification(
    notification: Notification,
    userSettings: UserNotificationSettings
  ): Promise<void> {
    try {
      if (!userSettings.pushSubscriptionEndpoint) {
        throw new Error("Push subscription endpoint not found");
      }

      if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        throw new Error("VAPID keys not configured");
      }

      // Parse the subscription data
      const subscription = {
        endpoint: userSettings.pushSubscriptionEndpoint,
        keys: userSettings.pushSubscriptionKeys
          ? JSON.parse(userSettings.pushSubscriptionKeys)
          : {},
      };

      // Prepare push payload
      const payload = JSON.stringify({
        title: notification.title,
        body: notification.message,
        icon: "icon-192x192.png", // Your app icon
        badge: "badge-72x72.png", // Badge icon
        url: notification.actionUrl || "/",
        tag: `notification-${notification._id}`,
        data: {
          notificationId: notification._id.toString(),
          contentType: notification.contentType,
          userId: notification.userId,
          url: notification.actionUrl || "/",
        },
        actions: notification.actionUrl
          ? [
              {
                action: "open",
                title: notification.actionText || "Open App",
                icon: "action-icon.png",
              },
              {
                action: "dismiss",
                title: "Dismiss",
                icon: "action-icon.png",
              },
            ]
          : [
              {
                action: "dismiss",
                title: "Dismiss",
                icon: "action-icon.png",
              },
            ],
        vibrate: [200, 100, 200], // Vibration pattern
        renotify: true, // Show even if same tag
        requireInteraction: false, // Auto-dismiss
        silent: false, // Enable sound
        sound: "assets/media/sounds/notification-sound.wav", // Custom notification sound
      });

      // Send the push notification
      await webpush.sendNotification(subscription, payload);
      console.log(
        `Push notification sent successfully to user: ${notification.userId}`
      );
    } catch (error) {
      console.error("Error sending push notification:", error);

      // Handle expired subscriptions
      if (error.statusCode === 410) {
        console.log("Push subscription expired, removing from user settings");
        // Clear the expired subscription
        userSettings.pushSubscriptionEndpoint = undefined;
        userSettings.pushSubscriptionKeys = undefined;
        await this.em.persistAndFlush(userSettings);
      }

      throw error;
    }
  }

  // Send email notification
  private async sendEmailNotification(
    notification: Notification
  ): Promise<void> {
    try {
      // Get user's email address
      const user = await this.em.findOne(User, {
        _id: new ObjectId(notification.userId),
      });
      if (!user || !user.email) {
        throw new Error("User email not found");
      }

      if (!process.env.SENDGRID_API_KEY) {
        throw new Error("SendGrid API key not configured");
      }

      // Prepare email content
      const emailContent = this.getEmailTemplate(notification);

      const msg = {
        to: user.email,
        from: process.env.FROM_EMAIL || "noreply@daylybread.com",
        subject: notification.title,
        text: notification.message,
        html: emailContent.html,
      };

      await sgMail.send(msg);
      console.log(`Email sent successfully to ${user.email}`);
    } catch (error) {
      console.error("Error sending email notification:", error);
      throw error;
    }
  }

  // Generate email template based on notification type
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

  // Send in-app notification
  private async sendInAppNotification(
    notification: Notification
  ): Promise<void> {
    // For now, in-app notifications are handled the same as WebSocket
    // In the future, this could store in-app notifications in a separate collection
    await this.sendWebSocketNotification(notification);
  }

  // Schedule a notification for when a mood cache expires
  public async scheduleMoodExpiredNotification(
    userId: string,
    mood: string,
    expirationTime: Date,
    deviceId?: string
  ): Promise<void> {
    try {
      // Get user's notification settings to determine which notifications to schedule
      const userSettings = await this.em.findOne(UserNotificationSettings, {
        userId: userId,
      });

      const notifications: Notification[] = [];

      // Schedule WebSocket notification if enabled (default: enabled)
      if (!userSettings || userSettings.enableWebSocketNotifications) {
        const wsNotification = Notification.createMoodRequestNotification(
          userId,
          mood,
          NotificationDeliveryType.WEBSOCKET,
          expirationTime
        );
        wsNotification.deviceId = deviceId;
        notifications.push(wsNotification);
      }

      // Schedule browser push notification if enabled
      if (
        userSettings &&
        userSettings.enableBrowserPushNotifications &&
        userSettings.pushSubscriptionEndpoint
      ) {
        const pushNotification = Notification.createMoodRequestNotification(
          userId,
          mood,
          NotificationDeliveryType.BROWSER_PUSH,
          expirationTime
        );
        pushNotification.message = `Your ${mood} mood request is ready! Open Daylybread to request a new verse.`;
        notifications.push(pushNotification);
      }

      // Schedule email notification if enabled
      if (userSettings && userSettings.enableEmailNotifications) {
        const emailNotification = Notification.createMoodRequestNotification(
          userId,
          mood,
          NotificationDeliveryType.EMAIL,
          expirationTime
        );
        emailNotification.message = `Your ${mood} mood request is ready! Visit Daylybread to request a new verse.`;
        notifications.push(emailNotification);
      }

      if (notifications.length > 0) {
        await this.em.persistAndFlush(notifications);
        console.log(
          `Scheduled ${notifications.length} notifications for mood: ${mood}, user: ${userId}`
        );
      }
    } catch (error) {
      console.error("Error scheduling mood expired notification:", error);
    }
  }

  // Check if content type is allowed for user
  private isContentTypeAllowed(
    contentType: NotificationContentType,
    userSettings: UserNotificationSettings | null
  ): boolean {
    if (!userSettings) {
      // Default to allowing mood request notifications if no settings
      return contentType === NotificationContentType.MOOD_REQUEST_AVAILABLE;
    }

    switch (contentType) {
      case NotificationContentType.MOOD_REQUEST_AVAILABLE:
        return userSettings.enableMoodRequestNotifications;
      case NotificationContentType.DAILY_VERSE:
        return userSettings.enableDailyVerseNotifications;
      case NotificationContentType.CHURCH_EVENT:
        return userSettings.enableChurchEventNotifications;
      case NotificationContentType.PRAYER_REMINDER:
        return userSettings.enablePrayerReminders;
      case NotificationContentType.COMMUNITY_UPDATE:
        return userSettings.enableCommunityUpdates;
      default:
        return false;
    }
  }

  // Clean up old notifications (completed/failed notifications older than 7 days)
  public async cleanupOldNotifications(): Promise<void> {
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const deletedCount = await this.em.nativeDelete(Notification, {
        status: {
          $in: [
            NotificationStatus.SENT,
            NotificationStatus.FAILED,
            NotificationStatus.CANCELLED,
          ],
        },
        createdAt: { $lt: weekAgo },
      });

      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} old notifications`);
      }
    } catch (error) {
      console.error("Error cleaning up old notifications:", error);
    }
  }

  // Get scheduler status
  public getStatus(): { isRunning: boolean; intervalActive: boolean } {
    return {
      isRunning: this.isRunning,
      intervalActive: this.checkInterval !== null,
    };
  }
}
