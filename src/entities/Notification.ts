import { Entity, PrimaryKey, Property, Enum, Index } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ObjectType } from "type-graphql";

// Unified notification content types for future expansion
export enum NotificationContentType {
  MOOD_REQUEST_AVAILABLE = "mood_request_available",
  DAILY_VERSE = "daily_verse",
  CHURCH_EVENT = "church_event",
  PRAYER_REMINDER = "prayer_reminder",
  COMMUNITY_UPDATE = "community_update",
  ACHIEVEMENT = "achievement",
}

export enum NotificationDeliveryType {
  WEBSOCKET = "websocket",
  BROWSER_PUSH = "browser_push",
  EMAIL = "email",
  IN_APP = "in_app",
}

export enum NotificationStatus {
  PENDING = "pending",
  SENT = "sent",
  FAILED = "failed",
  CANCELLED = "cancelled",
  READ = "read",
}

export enum NotificationPriority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  URGENT = "urgent",
}

@ObjectType()
@Entity({ collection: "notifications" }) // 👈 Unified collection name
@Index({ properties: ["userId", "createdAt"] }) // Feed queries
@Index({ properties: ["userId", "status", "createdAt"] }) // Filtered feeds
@Index({ properties: ["contentType", "createdAt"] }) // Type queries
@Index({ properties: ["scheduledFor", "status"] }) // Scheduler
@Index({ properties: ["deliveryType", "status"] }) // Delivery processing
export class Notification {
  @Field(() => String)
  @PrimaryKey()
  _id!: ObjectId;

  @Field(() => String)
  @Property()
  @Index() // Single field index for user lookups
  userId!: string;

  // Content classification
  @Field(() => String)
  @Enum(() => NotificationContentType)
  @Property()
  contentType!: NotificationContentType;

  @Field(() => String)
  @Enum(() => NotificationDeliveryType)
  @Property()
  deliveryType!: NotificationDeliveryType;

  @Field(() => String)
  @Enum(() => NotificationStatus)
  @Property()
  status: NotificationStatus = NotificationStatus.PENDING;

  @Field(() => String)
  @Enum(() => NotificationPriority)
  @Property()
  priority: NotificationPriority = NotificationPriority.NORMAL;

  // Core content
  @Field(() => String)
  @Property()
  title!: string;

  @Field(() => String)
  @Property()
  message!: string;

  // Flexible metadata for different notification types
  @Field(() => String, { nullable: true })
  @Property({ type: "json", nullable: true })
  metadata?: any; // JSON field for type-specific data

  // Action/navigation data
  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  actionUrl?: string;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  actionText?: string;

  // Delivery-specific fields
  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  deviceId?: string; // For WebSocket targeting

  // Scheduling
  @Field(() => Date, { nullable: true })
  @Property({ nullable: true })
  scheduledFor?: Date; // null = send immediately

  // Timestamps
  @Field(() => Date)
  @Property()
  @Index() // For time-based queries
  createdAt: Date = new Date();

  @Field(() => Date)
  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Field(() => Date, { nullable: true })
  @Property({ nullable: true })
  sentAt?: Date;

  @Field(() => Date, { nullable: true })
  @Property({ nullable: true })
  readAt?: Date;

  // Error tracking
  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  errorMessage?: string;

  @Field(() => Number)
  @Property()
  retryCount: number = 0;

  constructor() {
    this._id = new ObjectId();
  }

  // Factory methods for different notification types
  static createMoodRequestNotification(
    userId: string,
    mood: string,
    deliveryType: NotificationDeliveryType,
    scheduledFor?: Date
  ): Notification {
    const notification = new Notification();
    notification.userId = userId;
    notification.contentType = NotificationContentType.MOOD_REQUEST_AVAILABLE;
    notification.deliveryType = deliveryType;
    notification.title = `${
      mood.charAt(0).toUpperCase() + mood.slice(1)
    } Request Available`;
    notification.message = `Your ${mood} mood request is ready! Request a new verse.`;
    notification.metadata = { mood };
    notification.actionUrl = `/?mood=${mood}`;
    notification.actionText = "Request New Verse";
    notification.scheduledFor = scheduledFor;
    return notification;
  }

  static createDailyVerseNotification(
    userId: string,
    deliveryType: NotificationDeliveryType,
    verseReference?: string
  ): Notification {
    const notification = new Notification();
    notification.userId = userId;
    notification.contentType = NotificationContentType.DAILY_VERSE;
    notification.deliveryType = deliveryType;
    notification.title = "Daily Verse Available";
    notification.message = "Your daily verse is ready for today!";
    notification.metadata = { verseReference };
    notification.actionUrl = "/daily-verse";
    notification.actionText = "Read Today's Verse";
    return notification;
  }

  static createChurchEventNotification(
    userId: string,
    eventTitle: string,
    eventDate: Date,
    deliveryType: NotificationDeliveryType
  ): Notification {
    const notification = new Notification();
    notification.userId = userId;
    notification.contentType = NotificationContentType.CHURCH_EVENT;
    notification.deliveryType = deliveryType;
    notification.title = "Church Event";
    notification.message = `${eventTitle} is coming up!`;
    notification.metadata = { eventTitle, eventDate };
    notification.actionUrl = "/events";
    notification.actionText = "View Event";
    notification.priority = NotificationPriority.HIGH;
    return notification;
  }
}
// Keep user settings separate but with better naming
@ObjectType()
@Entity()
@Index({ properties: ["userId"], options: { unique: true } })
export class UserNotificationSettings {
  @Field(() => String)
  @PrimaryKey()
  _id!: ObjectId;

  @Field(() => String)
  @Property()
  userId!: string;

  // Content type preferences
  @Field(() => Boolean)
  @Property()
  enableMoodRequestNotifications: boolean = true;

  @Field(() => Boolean)
  @Property()
  enableDailyVerseNotifications: boolean = true;

  @Field(() => Boolean)
  @Property()
  enableChurchEventNotifications: boolean = true;

  @Field(() => Boolean)
  @Property()
  enablePrayerReminders: boolean = false;

  @Field(() => Boolean)
  @Property()
  enableCommunityUpdates: boolean = true;

  // Delivery method preferences
  @Field(() => Boolean)
  @Property()
  enableWebSocketNotifications: boolean = true;

  @Field(() => Boolean)
  @Property()
  enableBrowserPushNotifications: boolean = false;

  @Field(() => Boolean)
  @Property()
  enableEmailNotifications: boolean = false;

  @Field(() => Boolean)
  @Property()
  enableInAppNotifications: boolean = true;

  // Push notification subscription data
  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  pushSubscriptionEndpoint?: string;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  pushSubscriptionKeys?: string;

  // Timing preferences
  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  quietHoursStart?: string; // "22:00"

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  quietHoursEnd?: string; // "08:00"

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  timezone?: string;

  @Field(() => Date)
  @Property()
  createdAt: Date = new Date();

  @Field(() => Date)
  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor() {
    this._id = new ObjectId();
  }
}

