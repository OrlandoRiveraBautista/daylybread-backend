import { Migration } from "@mikro-orm/migrations-mongodb";

export class RenameVersesFieldMigration extends Migration {
  async up(): Promise<void> {
    const collection = this.getCollection("bookmark");
    await collection.updateMany({}, { $rename: { verses: "oldVerses" } });
  }

  async down(): Promise<void> {
    const collection = this.getCollection("bookmark");
    await collection.updateMany({}, { $rename: { oldVerses: "verses" } });
  }
}
