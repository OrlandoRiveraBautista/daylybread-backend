import { Migration } from "@mikro-orm/migrations-mongodb";

export class Migration20240401AddTypeAndMediaIdToNFCConfig extends Migration {
  async up(): Promise<void> {
    // Get all NFCConfig documents
    const nfcConfigs = await this.getCollection("nfcconfig").find({}).toArray();

    console.log(`Updating ${nfcConfigs.length} NFCConfig documents`);

    // Update each document to add the new fields
    for (const config of nfcConfigs) {
      const updates: any = {
        type: "link", // Set default type
      };

      // Update the document
      await this.getCollection("nfcconfig").updateOne(
        { _id: config._id },
        {
          $set: updates,
        }
      );
    }

    console.log(
      "Successfully added type and mediaId fields to all NFCConfig documents"
    );
  }

  async down(): Promise<void> {
    console.log("Removing type and mediaId fields from NFCConfig documents");

    // Remove the type and mediaId fields from all NFCConfig documents
    await this.getCollection("nfcconfig").updateMany(
      {},
      {
        $unset: {
          type: "",
        },
      }
    );

    console.log(
      "Successfully removed type and mediaId fields from all NFCConfig documents"
    );
  }
}
