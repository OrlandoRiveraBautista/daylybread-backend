import { EntityManager } from "@mikro-orm/mongodb";
// COMMENTED OUT: Unused imports while notification function is disabled
// import {
//   Notification,
//   UserNotificationSettings,
//   NotificationDeliveryType,
//   NotificationContentType,
//   NotificationStatus,
// } from "../entities/Notification";

export class DailyVerseService {
  // COMMENTED OUT: Unused property while notification function is disabled
  // private em: EntityManager;

  constructor(_em: EntityManager) {
    // COMMENTED OUT: Unused assignment while notification function is disabled
    // this.em = em;
  }

  /**
   * Schedule daily verse push notifications for all users who have enabled them
   */
  public async scheduleDailyVersePushNotifications(): Promise<void> {
    // COMMENTED OUT: Daily verse notification functionality temporarily disabled
    return;

    /* try {
      // Find all users with daily verse notifications enabled
      const userSettings = await this.em.find(UserNotificationSettings, {
        enableDailyVerseNotifications: true,
      });

      console.log(
        `📬 Found ${userSettings.length} users with daily verse notifications enabled`
      );

      const notifications: Notification[] = [];
      const now = new Date();

      for (const settings of userSettings) {
        // Schedule browser push notification if enabled and subscription exists
        if (
          settings.enableBrowserPushNotifications &&
          settings.pushSubscriptionEndpoint
        ) {
          const pushNotification = new Notification();
          pushNotification.userId = settings.userId;
          pushNotification.title = "📖 Your Daily Verse";
          pushNotification.message =
            "Start your day with God's Word. Tap to read today's verse!";
          pushNotification.deliveryType = NotificationDeliveryType.BROWSER_PUSH;
          pushNotification.contentType = NotificationContentType.DAILY_VERSE;
          pushNotification.status = NotificationStatus.PENDING;
          pushNotification.scheduledFor = now;
          pushNotification.actionUrl = "/daily-verse";
          pushNotification.actionText = "Read Now";
          notifications.push(pushNotification);
        }

        // Schedule email notification if enabled
        if (settings.enableEmailNotifications) {
          const emailNotification = new Notification();
          emailNotification.userId = settings.userId;
          emailNotification.title = "📖 Your Daily Verse";
          emailNotification.message =
            "Start your day with God's Word. Click below to read today's verse!";
          emailNotification.deliveryType = NotificationDeliveryType.EMAIL;
          emailNotification.contentType = NotificationContentType.DAILY_VERSE;
          emailNotification.status = NotificationStatus.PENDING;
          emailNotification.scheduledFor = now;
          emailNotification.actionUrl = "/daily-verse";
          emailNotification.actionText = "Read Today's Verse";
          notifications.push(emailNotification);
        }
      }

      if (notifications.length > 0) {
        await this.em.persistAndFlush(notifications);
        console.log(
          `✅ Scheduled ${notifications.length} daily verse notifications`
        );
      } else {
        console.log("ℹ️ No daily verse notifications to schedule");
      }
    } catch (error) {
      console.error("❌ Error scheduling daily verse notifications:", error);
      throw error;
    } */
  }
}
