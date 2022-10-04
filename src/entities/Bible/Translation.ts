import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType } from "type-graphql";

@ObjectType()
export class TranslationBook {
  @Field(() => String)
  @Property()
  bookName: string;

  @Field(() => String)
  @Property()
  bibleId: string;
}

@Entity()
@ObjectType()
export class Translation {
  @Field(() => ID)
  @PrimaryKey()
  _id!: ObjectId;

  @Field(() => String)
  @Property()
  name!: string;

  @Field(() => String)
  @Property()
  abbreviation!: string;

  @Field(() => String)
  @Property()
  language!: string;

  @Field(() => String)
  @Property()
  lang!: string;

  @Field(() => [TranslationBook])
  @Property()
  books!: TranslationBook[];
}
