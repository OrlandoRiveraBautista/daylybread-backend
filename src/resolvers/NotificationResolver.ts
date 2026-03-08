import {
  Resolver,
  Query,
  Mutation,
  Subscription,
  Arg,
  Ctx,
  Root,
  InputType,
  Field,
  ObjectType,
  FieldResolver,
} from "type-graphql";
import { PubSubEngine } from "graphql-subscriptions";
import { MyContext } from "../types";
import { FieldError } from "../entities/Errors/FieldError";
import { ValidateUser } from "../middlewares/userAuth";
import {
  Notification,
  UserNotificationSettings,
  NotificationDeliveryType,
  NotificationStatus,
  NotificationContentType,
} from "../entities/Notification";
import { User } from "../entities/User";
import { ObjectId } from "@mikro-orm/mongodb";

// Input types
@InputType()
export class NotificationSettingsInput {
  // Content type preferences
  @Field(() => Boolean, { nullable: true })
  enableMoodRequestNotifications?: boolean;

  @Field(() => Boolean, { nullable: true })
  enableDailyVerseNotifications?: boolean;

  @Field(() => Boolean, { nullable: true })
  enableChurchEventNotifications?: boolean;

  @Field(() => Boolean, { nullable: true })
  enablePrayerReminders?: boolean;

  @Field(() => Boolean, { nullable: true })
  enableCommunityUpdates?: boolean;

  // Delivery method preferences
  @Field(() => Boolean, { nullable: true })
  enableWebSocketNotifications?: boolean;

  @Field(() => Boolean, { nullable: true })
  enableBrowserPushNotifications?: boolean;

  @Field(() => Boolean, { nullable: true })
  enableEmailNotifications?: boolean;

  @Field(() => Boolean, { nullable: true })
  enableInAppNotifications?: boolean;

  @Field(() => String, { nullable: true })
  pushSubscriptionEndpoint?: string;

  @Field(() => String, { nullable: true })
  pushSubscriptionKeys?: string;

  // Timing preferences
  @Field(() => String, { nullable: true })
  quietHoursStart?: string;

  @Field(() => String, { nullable: true })
  quietHoursEnd?: string;

  @Field(() => String, { nullable: true })
  timezone?: string;
}

@InputType()
export class ScheduleNotificationInput {
  @Field(() => String)
  contentType!: string;

  @Field(() => String)
  deliveryType!: string;

  @Field(() => Date)
  scheduledFor!: Date;

  @Field(() => String, { nullable: true })
  deviceId?: string;

  @Field(() => String, { nullable: true })
  message?: string;

  @Field(() => String, { nullable: true })
  metadata?: string; // JSON string for type-specific data
}

// Output types
@ObjectType()
export class MoodNotificationMessage {
  @Field(() => String)
  mood!: string;

  @Field(() => String)
  message!: string;

  @Field(() => Date)
  timestamp!: Date;

  @Field(() => String)
  userId!: string;
}

@ObjectType()
export class NotificationSettingsResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => UserNotificationSettings, { nullable: true })
  settings?: UserNotificationSettings;
}

@ObjectType()
export class ScheduleNotificationResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => Notification, { nullable: true })
  notification?: Notification;
}

@Resolver(() => Notification)
export class NotificationResolver {
  // metadata is stored as a JSON object in MongoDB but typed as String in the
  // GraphQL schema — this FieldResolver serializes it before GraphQL touches it
  @FieldResolver(() => String, { nullable: true })
  metadata(@Root() notification: Notification): string | null {
    if (notification.metadata == null) return null;
    if (typeof notification.metadata === "string") return notification.metadata;
    return JSON.stringify(notification.metadata);
  }

  // WebSocket subscription for real-time mood notifications
  @Subscription(() => MoodNotificationMessage, {
    topics: ({ args }) => `MOOD_REQUEST_AVAILABLE_${args.userId}`,
  })
  moodRequestAvailable(
    @Root() notification: MoodNotificationMessage,
    @Arg("userId") _userId: string
  ): MoodNotificationMessage {
    return notification;
  }

  // Get user's notification settings
  @ValidateUser()
  @Query(() => NotificationSettingsResponse)
  async getUserNotificationSettings(
    @Ctx() context: MyContext
  ): Promise<NotificationSettingsResponse> {
    try {
      const req = context.request as any;
      if (!req.userId) {
        return {
          errors: [{ message: "User authentication required" }],
        };
      }

      const user =
        (await context.em.findOne(User, { _id: new ObjectId(req.userId) })) ??
        undefined;
      if (!user) {
        return {
          errors: [{ message: "User not found" }],
        };
      }

      let settings = await context.em.findOne(UserNotificationSettings, {
        userId: user._id.toString(),
      });

      if (!settings) {
        // Create default settings
        settings = new UserNotificationSettings();
        settings.userId = user._id.toString();
        await context.em.persistAndFlush(settings);
      }

      return { settings };
    } catch (error) {
      console.error("Error getting notification settings:", error);
      return {
        errors: [{ message: "Failed to get notification settings" }],
      };
    }
  }

  // Update user's notification settings
  @ValidateUser()
  @Mutation(() => NotificationSettingsResponse)
  async updateNotificationSettings(
    @Arg("input") input: NotificationSettingsInput,
    @Ctx() context: MyContext
  ): Promise<NotificationSettingsResponse> {
    try {
      const req = context.request as any;
      if (!req.userId) {
        return {
          errors: [{ message: "User authentication required" }],
        };
      }

      const user =
        (await context.em.findOne(User, { _id: new ObjectId(req.userId) })) ??
        undefined;
      if (!user) {
        return {
          errors: [{ message: "User not found" }],
        };
      }

      let settings = await context.em.findOne(UserNotificationSettings, {
        userId: user._id.toString(),
      });

      if (!settings) {
        settings = new UserNotificationSettings();
        settings.userId = user._id.toString();
      }

      // Update content type preferences
      if (input.enableMoodRequestNotifications !== undefined) {
        settings.enableMoodRequestNotifications =
          input.enableMoodRequestNotifications;
      }
      if (input.enableDailyVerseNotifications !== undefined) {
        settings.enableDailyVerseNotifications =
          input.enableDailyVerseNotifications;
      }
      if (input.enableChurchEventNotifications !== undefined) {
        settings.enableChurchEventNotifications =
          input.enableChurchEventNotifications;
      }
      if (input.enablePrayerReminders !== undefined) {
        settings.enablePrayerReminders = input.enablePrayerReminders;
      }
      if (input.enableCommunityUpdates !== undefined) {
        settings.enableCommunityUpdates = input.enableCommunityUpdates;
      }

      // Update delivery method preferences
      if (input.enableWebSocketNotifications !== undefined) {
        settings.enableWebSocketNotifications =
          input.enableWebSocketNotifications;
      }
      if (input.enableBrowserPushNotifications !== undefined) {
        settings.enableBrowserPushNotifications =
          input.enableBrowserPushNotifications;
      }
      if (input.enableEmailNotifications !== undefined) {
        settings.enableEmailNotifications = input.enableEmailNotifications;
      }
      if (input.enableInAppNotifications !== undefined) {
        settings.enableInAppNotifications = input.enableInAppNotifications;
      }

      // Update push subscription data
      if (input.pushSubscriptionEndpoint !== undefined) {
        settings.pushSubscriptionEndpoint = input.pushSubscriptionEndpoint;
      }
      if (input.pushSubscriptionKeys !== undefined) {
        settings.pushSubscriptionKeys = input.pushSubscriptionKeys;
      }

      // Update timing preferences
      if (input.quietHoursStart !== undefined) {
        settings.quietHoursStart = input.quietHoursStart;
      }
      if (input.quietHoursEnd !== undefined) {
        settings.quietHoursEnd = input.quietHoursEnd;
      }
      if (input.timezone !== undefined) {
        settings.timezone = input.timezone;
      }

      await context.em.persistAndFlush(settings);

      return { settings };
    } catch (error) {
      console.error("Error updating notification settings:", error);
      return {
        errors: [{ message: "Failed to update notification settings" }],
      };
    }
  }

  // Schedule a unified notification
  @ValidateUser()
  @Mutation(() => ScheduleNotificationResponse)
  async scheduleMoodNotification(
    @Arg("input") input: ScheduleNotificationInput,
    @Ctx() context: MyContext
  ): Promise<ScheduleNotificationResponse> {
    try {
      const req = context.request as any;
      if (!req.userId) {
        return {
          errors: [{ message: "User authentication required" }],
        };
      }

      const user =
        (await context.em.findOne(User, { _id: new ObjectId(req.userId) })) ??
        undefined;
      if (!user) {
        return {
          errors: [{ message: "User not found" }],
        };
      }

      // Validate content type
      const validContentTypes = Object.values(NotificationContentType);
      if (
        !validContentTypes.includes(
          input.contentType as NotificationContentType
        )
      ) {
        return {
          errors: [
            {
              message: `Invalid content type. Must be one of: ${validContentTypes.join(
                ", "
              )}`,
            },
          ],
        };
      }

      // Validate delivery type
      const validDeliveryTypes = Object.values(NotificationDeliveryType);
      if (
        !validDeliveryTypes.includes(
          input.deliveryType as NotificationDeliveryType
        )
      ) {
        return {
          errors: [
            {
              message: `Invalid delivery type. Must be one of: ${validDeliveryTypes.join(
                ", "
              )}`,
            },
          ],
        };
      }

      // Create notification
      const notification = new Notification();
      notification.userId = user._id.toString();
      notification.contentType = input.contentType as NotificationContentType;
      notification.deliveryType =
        input.deliveryType as NotificationDeliveryType;
      notification.scheduledFor = input.scheduledFor;
      notification.deviceId = input.deviceId;
      notification.title = input.message || "Notification";
      notification.message = input.message || "You have a new notification!";

      // Parse metadata if provided
      if (input.metadata) {
        try {
          notification.metadata = JSON.parse(input.metadata);
        } catch (e) {
          return {
            errors: [{ message: "Invalid metadata JSON format" }],
          };
        }
      }

      await context.em.persistAndFlush(notification);

      return { notification };
    } catch (error) {
      console.error("Error scheduling notification:", error);
      return {
        errors: [{ message: "Failed to schedule notification" }],
      };
    }
  }

  // Get user's pending notifications
  @ValidateUser()
  @Query(() => [Notification])
  async getUserPendingNotifications(
    @Ctx() context: MyContext
  ): Promise<Notification[]> {
    try {
      const req = context.request as any;
      if (!req.userId) {
        return [];
      }

      const user =
        (await context.em.findOne(User, { _id: new ObjectId(req.userId) })) ??
        undefined;
      if (!user) {
        return [];
      }

      return await context.em.find(
        Notification,
        {
          userId: user._id.toString(),
          status: NotificationStatus.PENDING,
          scheduledFor: { $gt: new Date() },
        },
        {
          orderBy: { scheduledFor: 1 },
        }
      );
    } catch (error) {
      console.error("Error getting pending notifications:", error);
      return [];
    }
  }

  // Cancel a pending notification
  @ValidateUser()
  @Mutation(() => Boolean)
  async cancelNotification(
    @Arg("notificationId") notificationId: string,
    @Ctx() context: MyContext
  ): Promise<boolean> {
    try {
      const req = context.request as any;
      if (!req.userId) {
        return false;
      }

      const user =
        (await context.em.findOne(User, { _id: new ObjectId(req.userId) })) ??
        undefined;
      if (!user) {
        return false;
      }

      const notification = await context.em.findOne(Notification, {
        _id: new ObjectId(notificationId),
        userId: user._id.toString(),
        status: NotificationStatus.PENDING,
      });

      if (notification) {
        notification.status = NotificationStatus.CANCELLED;
        await context.em.persistAndFlush(notification);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error cancelling notification:", error);
      return false;
    }
  }

  // Get user's in-app notifications (all unread/pending IN_APP notifications)
  @ValidateUser()
  @Query(() => [Notification])
  async getMyInAppNotifications(
    @Ctx() context: MyContext
  ): Promise<Notification[]> {
    try {
      const req = context.request as any;
      if (!req.userId) {
        return [];
      }

      return await context.em.find(
        Notification,
        {
          userId: req.userId,
          deliveryType: NotificationDeliveryType.IN_APP,
          status: { $in: [NotificationStatus.PENDING, NotificationStatus.SENT] },
        },
        {
          orderBy: { createdAt: -1 },
          limit: 50,
        }
      );
    } catch (error) {
      console.error("Error getting in-app notifications:", error);
      return [];
    }
  }

  // Mark a notification as read
  @ValidateUser()
  @Mutation(() => Boolean)
  async markNotificationRead(
    @Arg("notificationId") notificationId: string,
    @Ctx() context: MyContext
  ): Promise<boolean> {
    try {
      const req = context.request as any;
      if (!req.userId) {
        return false;
      }

      const notification = await context.em.findOne(Notification, {
        _id: new ObjectId(notificationId),
        userId: req.userId,
      });

      if (!notification) {
        return false;
      }

      notification.status = NotificationStatus.READ;
      notification.readAt = new Date();
      await context.em.persistAndFlush(notification);
      return true;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return false;
    }
  }

  // Get VAPID public key for frontend
  @Query(() => String)
  async getVapidPublicKey(): Promise<string> {
    return process.env.VAPID_PUBLIC_KEY || "";
  }

  // Test sending a push notification
  @ValidateUser()
  @Mutation(() => Boolean)
  async testPushNotification(@Ctx() context: MyContext): Promise<boolean> {
    try {
      const req = context.request as any;
      if (!req.userId) {
        return false;
      }

      // Create a test notification
      const notification = new Notification();
      notification.userId = req.userId;
      notification.contentType = NotificationContentType.COMMUNITY_UPDATE;
      notification.deliveryType = NotificationDeliveryType.BROWSER_PUSH;
      notification.title = "Test Notification";
      notification.message =
        "This is a test push notification from Daylybread!";
      notification.scheduledFor = new Date();

      await context.em.persistAndFlush(notification);
      return true;
    } catch (error) {
      console.error("Error sending test notification:", error);
      return false;
    }
  }

  // Utility method to send WebSocket notification
  static async sendWebSocketNotification(
    pubSub: PubSubEngine,
    userId: string,
    mood: string,
    message: string
  ): Promise<void> {
    const notification: MoodNotificationMessage = {
      mood,
      message,
      timestamp: new Date(),
      userId,
    };

    await pubSub.publish(`MOOD_REQUEST_AVAILABLE_${userId}`, notification);
  }
}
