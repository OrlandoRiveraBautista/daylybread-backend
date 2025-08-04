import { Entity, PrimaryKey, Property, ManyToOne } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType, registerEnumType } from "type-graphql";
import { User } from "./User";

export const CACHE_DURATIONS = {
  SHORT: 3600, // 1 hour (current)
  MEDIUM: 86400, // 1 day
  LONG: 604800, // 7 days (maximum)
  CUSTOM: 172800, // 2 days
};

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

@ObjectType()
export class MediaCache {
  @Field(() => String)
  @Property()
  url?: string;

  @Field(() => String)
  @Property()
  expiresAt?: Date;

  @Field(() => Number, { nullable: true })
  @Property({ nullable: true })
  duration?: number; // Store the duration used for this cache
}

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
  fileKey!: string;

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

  @Field(() => MediaCache, { nullable: true })
  @Property({ type: MediaCache, nullable: true })
  cache?: MediaCache;

  // Helper method to get recommended cache duration
  getCacheDuration(): number {
    switch (this.purpose) {
      case MediaPurpose.PROFILE_PICTURE:
        return 86400; // 1 day - changes occasionally
      case MediaPurpose.CHURCH_LOGO:
        return 604800; // 7 days - rarely changes
      case MediaPurpose.CONTENT_IMAGE:
        return 172800; // 2 days - moderate change frequency
      default:
        return 3600; // 1 hour - default safe option
    }
  }

  // Method to check if cache is valid
  isCacheValid(): boolean {
    return !!(
      this.cache?.url &&
      this.cache?.expiresAt &&
      new Date() < this.cache.expiresAt
    );
  }

  // Method to check if cache is about to expire (within 1 hour)
  isCacheExpiringSoon(): boolean {
    if (!this.cache?.expiresAt) return true;
    const oneHourFromNow = new Date(Date.now() + 3600 * 1000);
    return this.cache.expiresAt < oneHourFromNow;
  }
}
