import { Entity, PrimaryKey, Property, ManyToOne } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType, registerEnumType } from "type-graphql";
import { User } from "./User";

export enum MediaPurpose {
  PROFILE_PICTURE = "PROFILE_PICTURE",
  CHURCH_LOGO = "CHURCH_LOGO",
  CONTENT_IMAGE = "CONTENT_IMAGE",
  OTHER = "OTHER",
}

registerEnumType(MediaPurpose, {
  name: "MediaPurpose",
  description: "The purpose of the media file",
});

@Entity()
@ObjectType()
export class Media {
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
  url!: string;

  @Field(() => String)
  @Property()
  filename!: string;

  @Field(() => String)
  @Property()
  mimeType!: string;

  @Field(() => Number)
  @Property()
  size!: number;

  @Field(() => MediaPurpose)
  @Property({ type: "string" })
  purpose!: MediaPurpose;

  @Field(() => Boolean)
  @Property()
  isPublic: boolean = false;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  description?: string;
}
