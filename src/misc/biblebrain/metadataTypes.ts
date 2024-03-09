import { Field, ObjectType } from "type-graphql";
import { JSONScalar } from "../../types";

@ObjectType()
class BBPagination {
  @Field({ nullable: true })
  total?: number;

  @Field({ nullable: true })
  count?: number;

  @Field({ nullable: true })
  perPage?: number;

  @Field({ nullable: true })
  currentPage?: number;

  @Field({ nullable: true })
  totalPages?: number;

  @Field(() => JSONScalar, { nullable: true })
  links?: Record<string, string>;

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
