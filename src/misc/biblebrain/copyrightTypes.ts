import { Field, ObjectType } from "type-graphql";

@ObjectType()
class BBTranslation {
  @Field({ nullable: true })
  language_id?: number;

  @Field({ nullable: true })
  vernacular?: number;

  @Field({ nullable: true })
  alt?: number;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description_short?: string;
}

@ObjectType()
class BBLogo {
  @Field({ nullable: true })
  language_id?: number;

  @Field({ nullable: true })
  language_iso?: string;

  @Field({ nullable: true })
  url?: string;

  @Field({ nullable: true })
  icon?: number;
}

@ObjectType()
class BBOrganization {
  @Field({ nullable: true })
  id?: number;

  @Field({ nullable: true })
  slug?: string;

  @Field(() => String, { nullable: true })
  abbreviation?: any;

  @Field({ nullable: true })
  primaryColor?: string;

  @Field({ nullable: true })
  secondaryColor?: string;

  @Field({ nullable: true })
  inactive?: number;

  @Field(() => String, { nullable: true })
  url_facebook?: string;

  @Field(() => String, { nullable: true })
  url_website?: string;

  @Field(() => String, { nullable: true })
  url_donate?: string;

  @Field(() => String, { nullable: true })
  url_twitter?: string;

  @Field(() => String, { nullable: true })
  address?: string;

  @Field(() => String, { nullable: true })
  address2?: any;

  @Field(() => String, { nullable: true })
  city?: any;

  @Field(() => String, { nullable: true })
  state?: string;

  @Field(() => String, { nullable: true })
  country?: string;

  @Field(() => String, { nullable: true })
  zip?: any;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  email_director?: any;

  @Field(() => Number, { nullable: true })
  latitude?: number;

  @Field(() => Number, { nullable: true })
  longitude?: number;

  @Field({ nullable: true })
  laravel_through_key?: string;

  @Field(() => [BBLogo], { nullable: true })
  logos?: BBLogo[];

  @Field(() => [BBTranslation], { nullable: true })
  translations?: BBTranslation[];
}

@ObjectType()
class Copyright {
  @Field({ nullable: true })
  copyright_date?: string;

  @Field({ nullable: true })
  copyright?: string;

  @Field({ nullable: true })
  copyright_description?: string;

  @Field({ nullable: true })
  created_at?: string;

  @Field({ nullable: true })
  updated_at?: string;

  @Field({ nullable: true })
  open_access?: number;

  @Field(() => [BBOrganization], { nullable: true })
  organizations?: BBOrganization[];
}

@ObjectType()
export class BBCopyright {
  @Field({ nullable: true })
  id?: string;

  @Field({ nullable: true })
  asset_id?: string;

  @Field({ nullable: true })
  type?: string;

  @Field({ nullable: true })
  size?: string;

  @Field(() => Copyright, { nullable: true })
  copyright?: Copyright;
}
