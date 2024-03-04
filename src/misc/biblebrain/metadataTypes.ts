import { Field, ObjectType } from "type-graphql";

@ObjectType()
class BBPagination {
  @Field()
  total: number;

  @Field({ nullable: true })
  count?: number;

  @Field()
  perPage: number;

  @Field()
  currentPage: number;

  @Field({ nullable: true })
  totalPages?: number;

  @Field({ nullable: true })
  links?: number;

  @Field({ nullable: true })
  lastPage?: number;

  @Field({ nullable: true })
  nextPageUrl?: string;

  @Field({ nullable: true })
  prevPageUrl?: string;

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
