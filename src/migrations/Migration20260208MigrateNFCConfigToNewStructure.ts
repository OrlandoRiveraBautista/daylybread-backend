import { Migration } from "@mikro-orm/migrations-mongodb";
import { ObjectId } from "@mikro-orm/mongodb";

/**
 * Migration to convert existing NFCConfig data to the new architecture.
 * 
 * Old structure: NFCConfig had nfcIds[] array, tiles, wallpaper
 * New structure: 
 *   - NFCConfig = one per physical device (has nfcId, name, deviceType, homeScreen)
 *   - HomeScreen = reusable digital content (has tiles, wallpaper)
 * 
 * This migration:
 * 1. Creates HomeScreen documents from existing NFCConfig tiles/wallpaper
 * 2. Converts NFCConfig documents with nfcIds[] to individual NFCConfig documents (one per nfcId)
 * 3. Links NFCConfig devices to their HomeScreen
 */
export class Migration20260208MigrateNFCConfigToNewStructure extends Migration {
  async up(): Promise<void> {
    const nfcConfigCollection = this.getCollection("nfcconfig");
    const homeScreenCollection = this.getCollection("homescreen");

    // Get all existing NFCConfig documents
    const oldConfigs = await nfcConfigCollection.find({}).toArray();

    console.log(`\n🔄 Migrating ${oldConfigs.length} NFCConfig documents...`);

    for (const oldConfig of oldConfigs) {
      // Skip if already migrated (has nfcId field)
      if (oldConfig.nfcId) {
        console.log(`  ⏭️  Skipping already migrated config: ${oldConfig._id}`);
        continue;
      }

      // Generate unique shareable link for HomeScreen
      const shareableLink = this.generateUniqueLink();

      // Create HomeScreen from tiles/wallpaper if they exist
      let homeScreenId = null;
      if (oldConfig.tiles || oldConfig.wallpaper) {
        const homeScreenData = {
          _id: new ObjectId(),
          createdAt: oldConfig.createdAt || new Date(),
          updatedAt: oldConfig.updatedAt || new Date(),
          owner: oldConfig.owner,
          name: "Home Screen", // Default name, users can change it
          shareableLink: shareableLink,
          tiles: oldConfig.tiles || [],
          wallpaper: oldConfig.wallpaper || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          views: 0,
          lastViewedAt: null,
        };

        await homeScreenCollection.insertOne(homeScreenData);
        homeScreenId = homeScreenData._id;
        console.log(`  ✅ Created HomeScreen: ${homeScreenData._id}`);
      }

      // Convert nfcIds array to individual NFCConfig documents
      if (oldConfig.nfcIds && Array.isArray(oldConfig.nfcIds) && oldConfig.nfcIds.length > 0) {
        for (let i = 0; i < oldConfig.nfcIds.length; i++) {
          const nfcId = oldConfig.nfcIds[i];
          
          // Skip empty nfcIds
          if (!nfcId || nfcId.trim() === "") {
            continue;
          }

          // Check if NFCConfig with this nfcId already exists
          const existing = await nfcConfigCollection.findOne({ nfcId: nfcId });
          if (existing) {
            console.log(`  ⚠️  NFCConfig with nfcId "${nfcId}" already exists, skipping`);
            continue;
          }

          // Create new NFCConfig document (one per physical device)
          const newNFCConfig = {
            _id: new ObjectId(),
            createdAt: oldConfig.createdAt || new Date(),
            updatedAt: oldConfig.updatedAt || new Date(),
            owner: oldConfig.owner,
            nfcId: nfcId,
            name: `NFC Device ${i + 1}`, // Default name
            deviceType: null, // Unknown device type for migrated devices
            homeScreen: homeScreenId,
            views: 0,
            lastScannedAt: null,
          };

          await nfcConfigCollection.insertOne(newNFCConfig);
          console.log(`  ✅ Created NFCConfig device: ${nfcId} -> HomeScreen ${homeScreenId || 'none'}`);
        }
      } else {
        // No nfcIds, but might have tiles/wallpaper - create a device without nfcId
        // Actually, we can't create NFCConfig without nfcId (it's required)
        // So we'll just create the HomeScreen and skip the device
        console.log(`  ⚠️  Config ${oldConfig._id} has no nfcIds, only created HomeScreen`);
      }

      // Delete the old NFCConfig document
      await nfcConfigCollection.deleteOne({ _id: oldConfig._id });
      console.log(`  🗑️  Deleted old NFCConfig: ${oldConfig._id}`);
    }

    console.log(`\n✨ Migration complete!\n`);
  }

  async down(): Promise<void> {
    // This migration is not easily reversible
    // Would need to reconstruct old structure from new structure
    console.log(`\n⚠️  Rollback not supported for this migration\n`);
  }

  /**
   * Generates a unique random string for shareable links.
   */
  private generateUniqueLink(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
