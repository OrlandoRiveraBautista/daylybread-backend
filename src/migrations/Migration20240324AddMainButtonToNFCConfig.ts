import { Migration } from "@mikro-orm/migrations-mongodb";

export class Migration20240324AddMainButtonToNFCConfig extends Migration {
  async up(): Promise<void> {
    // Get all NFCConfig documents
    const nfcConfigs = await this.getCollection("nfcconfig").find({}).toArray();

    // Update each document
    for (const config of nfcConfigs) {
      const updates: any = {
        mainButton: {
          url: config.url || "", // Transfer the old url value
          text: "Visit Website", // Set default text
        },
      };

      // Update the document
      await this.getCollection("nfcconfig").updateOne(
        { _id: config._id },
        {
          $set: updates,
          $unset: { url: "" }, // Remove the old url field
        }
      );
    }
  }

  async down(): Promise<void> {
    // Get all NFCConfig documents
    const nfcConfigs = await this.getCollection("nfcconfig").find({}).toArray();

    // Update each document
    for (const config of nfcConfigs) {
      const updates: any = {
        url: config.mainButton?.url || "", // Restore the old url field
      };

      // Update the document
      await this.getCollection("nfcconfig").updateOne(
        { _id: config._id },
        {
          $set: updates,
          $unset: { mainButton: "" }, // Remove the mainButton field
        }
      );
    }
  }
}
