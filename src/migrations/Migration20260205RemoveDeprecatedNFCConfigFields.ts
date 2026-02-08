import { Migration } from "@mikro-orm/migrations-mongodb";

export class Migration20260205RemoveDeprecatedNFCConfigFields extends Migration {
  async up(): Promise<void> {
    // Remove deprecated fields from all NFCConfig documents
    await this.getCollection("nfcconfig").updateMany(
      {},
      {
        $unset: {
          type: "",
          mainButton: "",
          title: "",
          description: "",
          socialMedia: "",
          givingLink: "",
          memberRegistrationLink: "",
          eventsLink: "",
          mediaId: "",
          media: "",
        },
      }
    );
  }

  async down(): Promise<void> {
    // Restore default values for deprecated fields
    // Note: Original data cannot be restored, only default values
    await this.getCollection("nfcconfig").updateMany(
      {},
      {
        $set: {
          type: "link",
          mainButton: {
            url: "",
            text: "",
          },
          title: "",
          description: "",
          socialMedia: {
            facebook: false,
            instagram: false,
            twitter: false,
          },
          givingLink: {
            isVisible: false,
            url: "",
          },
          memberRegistrationLink: {
            isVisible: false,
            url: "",
          },
          eventsLink: {
            isVisible: false,
            url: "",
          },
        },
      }
    );
  }
}
