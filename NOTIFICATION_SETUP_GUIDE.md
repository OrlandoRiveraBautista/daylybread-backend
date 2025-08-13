# 🔔 Notification System Setup Guide

## 📧 Email Notifications Setup

### 1. SendGrid Setup (Recommended)

1. **Create SendGrid Account**: Sign up at [sendgrid.com](https://sendgrid.com)
2. **Get API Key**:
   - Go to Settings → API Keys
   - Create new key with "Mail Send" permissions
   - Copy the key (starts with `SG.`)
3. **Add to Environment**:
   ```bash
   SENDGRID_API_KEY=SG.your_actual_api_key_here
   FROM_EMAIL=noreply@yourdomain.com
   FRONTEND_URL=https://yourdomain.com
   ```

### 2. Alternative: Gmail/SMTP Setup

If you prefer using Gmail or your own SMTP:

```bash
# For Gmail (requires App Password)
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=your_app_password  # Not your regular password!
FROM_EMAIL=your-gmail@gmail.com
```

To get Gmail App Password:

1. Enable 2-Factor Authentication
2. Go to Google Account Settings → Security → App Passwords
3. Generate password for "Mail"

## 📱 Push Notifications Setup

### 1. Generate VAPID Keys

Run this command to generate VAPID keys:

```bash
node scripts/generateVapidKeys.js
```

Add the output to your `.env`:

```bash
VAPID_PUBLIC_KEY=your_generated_public_key
VAPID_PRIVATE_KEY=your_generated_private_key
VAPID_SUBJECT=mailto:your-email@yourdomain.com
```

### 2. Frontend Setup

1. **Copy Service Worker**: Copy `frontend-examples/service-worker.js` to your frontend's `public/sw.js`
2. **Copy Push Service**: Copy `frontend-examples/pushNotificationService.ts` to your frontend
3. **Initialize in your app**:

   ```typescript
   // In your main app component
   import { PushNotificationService } from "./services/pushNotificationService";

   const pushService = new PushNotificationService(
     process.env.REACT_APP_VAPID_PUBLIC_KEY
   );

   // Request permission and subscribe
   const initializePush = async () => {
     const hasPermission = await pushService.initialize();
     if (hasPermission) {
       const subscription = await pushService.subscribe();
       if (subscription) {
         await pushService.sendSubscriptionToBackend(subscription, userId);
       }
     }
   };
   ```

### 3. Add Icons

Add these icons to your frontend public folder:

- `icon-192x192.png` - Main notification icon
- `badge-72x72.png` - Badge icon (monochrome, for notification badge)
- `action-icon.png` - Action button icon

## 🚀 Testing Your Setup

### 1. Test Email Notifications

```graphql
mutation TestEmail {
  scheduleMoodNotification(
    input: {
      contentType: "daily_verse"
      deliveryType: "email"
      scheduledFor: "2024-01-15T10:00:00Z"
      message: "Your daily verse is ready!"
    }
  ) {
    success
    errors {
      message
    }
  }
}
```

### 2. Test Push Notifications

```graphql
mutation TestPush {
  testPushNotification
}
```

### 3. Get VAPID Public Key (for frontend)

```graphql
query GetVapidKey {
  getVapidPublicKey
}
```

## 🔧 Environment Variables Summary

Add these to your `.env` file:

```bash
# Email (SendGrid)
SENDGRID_API_KEY=SG.your_api_key
FROM_EMAIL=noreply@yourdomain.com

# Push Notifications
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:your-email@yourdomain.com

# General
FRONTEND_URL=https://yourdomain.com
```

## 📱 Mobile App Push Notifications

For native mobile apps (React Native, Flutter, etc.), you'll need:

### React Native

1. **Install dependencies**:
   ```bash
   npm install @react-native-firebase/app @react-native-firebase/messaging
   ```
2. **Setup Firebase Cloud Messaging (FCM)**
3. **Send FCM tokens to your backend** instead of web push subscriptions

### Flutter

1. **Add firebase_messaging** to pubspec.yaml
2. **Setup FCM configuration**
3. **Send FCM tokens to backend**

## 🎯 Usage Examples

### Schedule Daily Verse Notifications

```typescript
// In your cron job or scheduler
const tomorrowMorning = new Date();
tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
tomorrowMorning.setHours(8, 0, 0, 0); // 8 AM

const notification = new Notification();
notification.userId = user.id;
notification.contentType = NotificationContentType.DAILY_VERSE;
notification.deliveryType = NotificationDeliveryType.EMAIL;
notification.title = "Your Daily Verse";
notification.message = "Start your day with God's word";
notification.scheduledFor = tomorrowMorning;
notification.actionUrl = "/daily-verse";
notification.actionText = "Read Now";

await em.persistAndFlush(notification);
```

### Immediate Notifications

```typescript
// Send immediate notification
const notification = new Notification();
notification.userId = userId;
notification.contentType = NotificationContentType.ACHIEVEMENT;
notification.deliveryType = NotificationDeliveryType.WEBSOCKET;
notification.title = "Congratulations! 🎉";
notification.message = "You've read 7 days in a row!";
notification.scheduledFor = new Date(); // Send now

await em.persistAndFlush(notification);
```

## 🚨 Troubleshooting

### Email Issues

- **"Unauthorized"**: Check SendGrid API key
- **"From email not verified"**: Verify sender email in SendGrid
- **Rate limits**: SendGrid free tier has daily limits

### Push Notification Issues

- **"Invalid VAPID"**: Regenerate VAPID keys
- **Notifications not showing**: Check browser permissions
- **Service worker not registering**: Check browser developer tools
- **Subscription failed**: Ensure HTTPS in production

### General Issues

- **Environment variables not loading**: Restart your server
- **Notifications not sending**: Check notification scheduler is running
- **Database errors**: Ensure MongoDB connection is stable

## 🔄 Starting the Notification System

Make sure to start the notification scheduler in your main server file:

```typescript
// In server.ts or app.ts
import { NotificationScheduler } from "./services/NotificationScheduler";

const notificationScheduler = new NotificationScheduler(em, pubSub);
notificationScheduler.start(); // Start checking every minute

// Optional: Clean up old notifications daily
setInterval(async () => {
  await notificationScheduler.cleanupOldNotifications();
}, 24 * 60 * 60 * 1000); // Every 24 hours
```

You're all set! 🎉
