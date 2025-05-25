import { Migration } from "@mikro-orm/migrations-mongodb";

export class Migration20240322AddEventsLinkToNFCConfig extends Migration {
  async up(): Promise<void> {
    // Add events link field to NFCConfig collection
    await this.getCollection("nfcconfig").updateMany(
      {},
      {
        $set: {
          eventsLink: null,
        },
      }
    );
  }

  async down(): Promise<void> {
    // Remove events link field from NFCConfig collection
    await this.getCollection("nfcconfig").updateMany(
      {},
      {
        $unset: {
          eventsLink: "",
        },
      }
    );
  }
}
