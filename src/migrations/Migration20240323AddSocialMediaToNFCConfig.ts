import { Migration } from "@mikro-orm/migrations-mongodb";

export class Migration20240323AddSocialMediaToNFCConfig extends Migration {
  async up(): Promise<void> {
    // Add socialMedia field to NFCConfig collection
    await this.getCollection("nfcconfig").updateMany(
      {},
      {
        $set: {
          socialMedia: {
            facebook: false,
            instagram: false,
            twitter: false,
          },
        },
      }
    );
  }

  async down(): Promise<void> {
    // Remove socialMedia field from NFCConfig collection
    await this.getCollection("nfcconfig").updateMany(
      {},
      {
        $unset: {
          socialMedia: "",
        },
      }
    );
  }
}
