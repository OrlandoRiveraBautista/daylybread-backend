import { Entity, PrimaryKey, Property, ManyToOne } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType, InputType } from "type-graphql";
import { User } from "./User";
import { Media } from "./Media";

@ObjectType()
class mainButton {
  @Field(() => String)
  @Property()
  url: string = "";

  @Field(() => String)
  @Property()
  text: string = "";
}

/**
 * Position of a tile on the home screen grid
 */
@ObjectType()
export class TilePosition {
  @Field(() => Number)
  @Property()
  x: number = 0;

  @Field(() => Number)
  @Property()
  y: number = 0;
}

@InputType()
export class TilePositionInput {
  @Field(() => Number)
  x!: number;

  @Field(() => Number)
  y!: number;
}

/**
 * Configuration for a single tile on the iPhone-style home screen
 */
@ObjectType()
export class TileConfig {
  @Field(() => String)
  @Property()
  id!: string;

  @Field(() => String)
  @Property()
  type!: string; // "website" | "give" | "events" | "sermons" | "prayer" | "groups" | "contact" | "social" | "custom"

  @Field(() => String)
  @Property()
  label!: string;

  @Field(() => String)
  @Property()
  icon!: string; // Ionicon name or custom URL

  @Field(() => String)
  @Property()
  url!: string;

  @Field(() => String)
  @Property()
  size!: string; // "small" | "medium" | "large"

  @Field(() => TilePosition)
  @Property({ type: TilePosition })
  position!: TilePosition;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  color?: string; // Background color (hex or CSS color)

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  subtitle?: string; // Optional subtitle for medium/large tiles

  @Field(() => Boolean, { nullable: true })
  @Property({ nullable: true })
  isInDock?: boolean; // Whether this tile appears in the dock
}

@InputType()
export class TileConfigInput {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  type!: string;

  @Field(() => String)
  label!: string;

  @Field(() => String)
  icon!: string;

  @Field(() => String)
  url!: string;

  @Field(() => String)
  size!: string;

  @Field(() => TilePositionInput)
  position!: TilePositionInput;

  @Field(() => String, { nullable: true })
  color?: string;

  @Field(() => String, { nullable: true })
  subtitle?: string;

  @Field(() => Boolean, { nullable: true })
  isInDock?: boolean;
}

@ObjectType()
export class SocialMediaSettings {
  @Field(() => Boolean)
  @Property()
  facebook: boolean = false;

  @Field(() => Boolean)
  @Property()
  instagram: boolean = false;

  @Field(() => Boolean)
  @Property()
  twitter: boolean = false;
}

@ObjectType()
export class LinkSettings {
  @Field(() => Boolean)
  @Property()
  isVisible: boolean = false;

  @Field(() => String)
  @Property()
  url: string = "";
}

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

  @Field(() => String)
  @Property()
  type: string = "link";

  @Field(() => [String])
  @Property({ type: "array" })
  nfcIds: string[] = [];

  @Field(() => mainButton)
  @Property({ type: mainButton })
  mainButton!: mainButton;

  @Field(() => String)
  @Property()
  title!: string;

  @Field(() => String)
  @Property()
  description!: string;

  // Store the media ID in the database
  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  mediaId?: string;

  // Virtual field to get the media
  @Field(() => Media, { nullable: true })
  media?: Media;

  @Field(() => SocialMediaSettings)
  @Property({ type: SocialMediaSettings })
  socialMedia: SocialMediaSettings = new SocialMediaSettings();

  @Field(() => LinkSettings, { nullable: true })
  @Property({ type: LinkSettings, nullable: true })
  givingLink?: LinkSettings;

  @Field(() => LinkSettings, { nullable: true })
  @Property({ type: LinkSettings, nullable: true })
  memberRegistrationLink?: LinkSettings;

  @Field(() => LinkSettings, { nullable: true })
  @Property({ type: LinkSettings, nullable: true })
  eventsLink?: LinkSettings;

  /**
   * iPhone-style home screen tiles configuration
   * Stores the layout and settings for all tiles on the NFC page
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
}
