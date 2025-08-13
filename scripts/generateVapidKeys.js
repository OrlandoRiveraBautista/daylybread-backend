// Run this script to generate VAPID keys for push notifications
const webpush = require("web-push");

const vapidKeys = webpush.generateVAPIDKeys();

console.log("VAPID Keys Generated:");
console.log("===================");
console.log("Public Key:", vapidKeys.publicKey);
console.log("Private Key:", vapidKeys.privateKey);
console.log("");
console.log("Add these to your .env file:");
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:your-email@yourdomain.com");
