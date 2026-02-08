import { Entity, PrimaryKey, Property, ManyToOne } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType } from "type-graphql";
import { User } from "./User";
import { TileConfig } from "./TileConfig";

/**
 * HomeScreen Entity - Represents the digital content (tiles, wallpaper, layout)
 * A HomeScreen can exist independently and be shared via link
 * Multiple NFCDevices can point to the same HomeScreen
 */
@Entity({ collection: "homescreen" })
@ObjectType()
export class HomeScreen {
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

  @Field(() => String)
  @Property()
  name!: string; // e.g., "Sunday Service", "Main Campus", "Youth Ministry"

  @Field(() => String)
  @Property({ unique: true })
  shareableLink!: string; // Unique URL slug (e.g., "abc123" -> /nfc/abc123)

  /**
   * iPhone-style home screen tiles configuration
   * Stores the layout and settings for all tiles on the home screen
   */
  @Field(() => [TileConfig], { nullable: true })
  @Property({ type: "json", nullable: true })
  tiles?: TileConfig[];

  /**
   * Wallpaper/background for the home screen
   * Can be a color, gradient, or image URL
   */
  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  wallpaper?: string;

  /**
   * Total number of views via shareable link
   */
  @Field(() => Number)
  @Property({ default: 0 })
  views: number = 0;

  /**
   * Last time this home screen was viewed via link
   */
  @Field(() => String, { nullable: true })
  @Property({ type: "date", nullable: true })
  lastViewedAt?: Date;
}
