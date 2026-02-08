import { Property } from "@mikro-orm/core";
import { Field, ObjectType, InputType } from "type-graphql";

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
