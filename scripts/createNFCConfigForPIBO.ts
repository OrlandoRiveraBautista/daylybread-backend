import dotenv from "dotenv";
import path from "path";

// IMPORTANT: Load .env BEFORE importing mikroOrmConfig
// Otherwise the config won't have access to environment variables
const envPath = path.join(__dirname, "../.env");
const result = dotenv.config({ path: envPath });

import { MikroORM } from "@mikro-orm/core";
import { MongoDriver } from "@mikro-orm/mongodb";
import { ObjectId } from "@mikro-orm/mongodb";
import mikroOrmConfig from "../src/mikro-orm.config";

/**
 * Script to create an NFC config with a specific ID and owner
 * Usage: ts-node scripts/createNFCConfig.ts
 */
async function createNFCConfig() {
  const nfcConfigId = "683127b50fa60011a492d655";
  const ownerId = "6840feaa3fe644fbb127364e";

  console.log("🚀 Starting NFC Config creation...");
  console.log(`   NFC Config ID: ${nfcConfigId}`);
  console.log(`   Owner ID: ${ownerId}`);
  console.log(`   Looking for .env at: ${envPath}`);
  
  // Debug: Check if .env was loaded
  if (result.error) {
    console.error("❌ ERROR: Could not load .env file!");
    console.error(`   Error: ${result.error.message}`);
    process.exit(1);
  }
  
  // Debug: Check if connection URL is loaded
  if (!process.env.MONGODBCLIENTURL) {
    console.error("❌ ERROR: MONGODBCLIENTURL environment variable is not set!");
    console.error("   The .env file was loaded, but MONGODBCLIENTURL is missing or empty.");
    console.error("   Please check your .env file has: MONGODBCLIENTURL=<your-mongodb-connection-string>");
    process.exit(1);
  }
  console.log("✅ MongoDB connection URL loaded from environment");

  // Initialize MikroORM
  const orm = await MikroORM.init<MongoDriver>(mikroOrmConfig);

  try {
    // Access MongoDB driver - need to get the platform-specific connection
    const driver = orm.em.getDriver() as MongoDriver;
    const connection = driver.getConnection();
    const db = connection.getDb();
    
    // Get collections
    const nfcConfigCollection = db.collection("nfcconfig");
    const userCollection = db.collection("user");

    console.log(`   Connected to database successfully`);

    // Check if NFC config with this ID already exists
    const existing = await nfcConfigCollection.findOne({
      _id: new ObjectId(nfcConfigId),
    });

    if (existing) {
      console.log("⚠️  NFC Config with this ID already exists!");
      console.log("   Existing config:", JSON.stringify(existing, null, 2));
      await orm.close();
      process.exit(1);
    }

    // Check if owner exists
    const owner = await userCollection.findOne({
      _id: new ObjectId(ownerId),
    });

    if (!owner) {
      console.log(`⚠️  Owner with ID ${ownerId} not found!`);
      await orm.close();
      process.exit(1);
    }

    console.log("✅ Owner found");

    // Create NFC config document
    const now = new Date();
    const nfcConfigData = {
      _id: new ObjectId(nfcConfigId),
      createdAt: now,
      updatedAt: now,
      owner: new ObjectId(ownerId),
      nfcId: nfcConfigId, // Using the same ID as nfcId (you can change this if needed)
      name: "NFC Device", // Default name (you can change this if needed)
      deviceType: null, // Optional
      homeScreen: null, // Optional
      views: 0,
      lastScannedAt: null,
    };

    // Insert the NFC config
    await nfcConfigCollection.insertOne(nfcConfigData);

    console.log("✅ NFC Config created successfully!");
    console.log("   Config:", JSON.stringify(nfcConfigData, null, 2));

    await orm.close();
    console.log("✨ Script completed!");
  } catch (error) {
    console.error("❌ Error creating NFC config:", error);
    await orm.close();
    process.exit(1);
  }
}

createNFCConfig().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
