import { Migration } from "@mikro-orm/migrations-mongodb";

export class Migration20240320 extends Migration {
  async up(): Promise<void> {
    // Get all NFCConfig documents
    const nfcConfigs = await this.getCollection("nfcconfig").find({}).toArray();

    // Update each document
    for (const config of nfcConfigs) {
      const updates: any = {};

      // Convert givingLink if it exists
      if (config.givingLink) {
        updates.givingLink = {
          isVisible: true,
          url: config.givingLink,
        };
      }

      // Convert memberRegistrationLink if it exists
      if (config.memberRegistrationLink) {
        updates.memberRegistrationLink = {
          isVisible: true,
          url: config.memberRegistrationLink,
        };
      }

      // Convert eventsLink if it exists
      if (config.eventsLink) {
        updates.eventsLink = {
          isVisible: true,
          url: config.eventsLink,
        };
      }

      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        await this.getCollection("nfcconfig").updateOne(
          { _id: config._id },
          { $set: updates }
        );
      }
    }
  }

  async down(): Promise<void> {
    // Get all NFCConfig documents
    const nfcConfigs = await this.getCollection("nfcconfig").find({}).toArray();

    // Update each document
    for (const config of nfcConfigs) {
      const updates: any = {};

      // Convert givingLink back to string if it exists
      if (config.givingLink?.url) {
        updates.givingLink = config.givingLink.url;
      }

      // Convert memberRegistrationLink back to string if it exists
      if (config.memberRegistrationLink?.url) {
        updates.memberRegistrationLink = config.memberRegistrationLink.url;
      }

      // Convert eventsLink back to string if it exists
      if (config.eventsLink?.url) {
        updates.eventsLink = config.eventsLink.url;
      }

      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        await this.getCollection("nfcconfig").updateOne(
          { _id: config._id },
          { $set: updates }
        );
      }
    }
  }
}
