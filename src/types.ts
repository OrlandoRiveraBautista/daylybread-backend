// import { IDatabaseDriver, Connection } from "@mikro-orm/core";
import { EntityManager } from "@mikro-orm/mongodb";

export type MyContext = {
  em: EntityManager;
};
