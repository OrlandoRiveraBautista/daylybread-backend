import { Migration } from "@mikro-orm/migrations-mongodb";

export class Migration20240322AddLinksToNFCConfig extends Migration {
  async up(): Promise<void> {
    // Add giving and member registration link fields to NFCConfig collection
    await this.getCollection("nfcconfig").updateMany(
      {},
      {
        $set: {
          givingLink: null,
          memberRegistrationLink: null,
        },
      }
    );
  }

  async down(): Promise<void> {
    // Remove giving and member registration link fields from NFCConfig collection
    await this.getCollection("nfcconfig").updateMany(
      {},
      {
        $unset: {
          givingLink: "",
          memberRegistrationLink: "",
        },
      }
    );
  }
}
