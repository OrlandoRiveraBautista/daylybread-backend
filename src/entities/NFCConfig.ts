import { Entity, PrimaryKey, Property, ManyToOne } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType } from "type-graphql";
import { User } from "./User";
import { HomeScreen } from "./HomeScreen";

/**
 * NFCConfig Entity - Represents a physical NFC device/tag
 * Each physical tag has its own NFCConfig
 * One NFCConfig per physical device
 * User "owns" the device by being the owner
 * Can be assigned to a HomeScreen
 */
@Entity()
@ObjectType()
export class NFCConfig {
  @Field(() => ID)
  @PrimaryKey()
  _id!: ObjectId;

  @Field(() => String)
  @Property({ type: "date" })
  createdAt? = new Date();

  @Field(() => String)
  @Property({ type: "date", onUpdate: () => new Date() })
  updatedAt? = new Date();

  @Field(() => User)
  @ManyToOne(() => User)
  owner!: User;

  /**
   * Unique physical tag ID (the ID on the actual NFC tag)
   * Note: unique constraint will be added after migration is complete
   */
  @Field(() => String)
  @Property()
  nfcId!: string;

  /**
   * User-defined name for this device
   */
  @Field(() => String)
  @Property()
  name!: string; // e.g., "Church Entrance Tag", "Lobby Card"

  /**
   * Type of physical device
   */
  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  deviceType?: string; // e.g., "church-tap", "card-tap-white", "card-tap-transparent"

  /**
   * Reference to the HomeScreen this device displays
   */
  @Field(() => HomeScreen, { nullable: true })
  @ManyToOne(() => HomeScreen, { nullable: true })
  homeScreen?: HomeScreen;

  /**
   * Total number of NFC scans
   */
  @Field(() => Number)
  @Property({ default: 0 })
  views: number = 0;

  /**
   * Last time this physical tag was scanned
   */
  @Field(() => String, { nullable: true })
  @Property({ type: "date", nullable: true })
  lastScannedAt?: Date;
}
