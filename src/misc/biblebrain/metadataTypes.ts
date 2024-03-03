import { Field, ObjectType } from "type-graphql";

@ObjectType()
class BBPagination {
  @Field()
  total: number;

  @Field({ nullable: true })
  count?: number;

  @Field()
  per_page: number;

  @Field()
  current_page: number;

  @Field({ nullable: true })
  total_pages?: number;

  @Field({ nullable: true })
  links?: number;

  @Field({ nullable: true })
  last_page?: number;

  @Field({ nullable: true })
  next_page_url?: string;

  @Field({ nullable: true })
  prev_page_url?: string;

  @Field({ nullable: true })
  from?: number;

  @Field({ nullable: true })
  to?: number;
}

@ObjectType()
export class BBMetadata {
  @Field(() => BBPagination)
  pagination: BBPagination;
}
