import { Entity, PrimaryKey, Property, ManyToOne } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType } from "type-graphql";
import { User } from "./User";

@ObjectType()
class mainButton {
  @Field(() => String)
  @Property()
  url: string = "";

  @Field(() => String)
  @Property()
  text: string = "";
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
}
