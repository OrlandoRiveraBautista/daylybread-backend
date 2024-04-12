import path from "path";
import { MikroORM } from "@mikro-orm/core";
import { MongoDriver } from "@mikro-orm/mongodb";

/* Entities */
import { User } from "./entities/User";
import { Translation } from "./entities/Bible/Translation";
import { Test } from "./entities/Test";
import { Book } from "./entities/Bible/Book";
import { Chapter } from "./entities/Bible/Chapter";
import { Verse } from "./entities/Bible/Verse";
import { Bookmark } from "./entities/Bookmark";
import { AIMessage } from "./entities/AIMemory";

const config: Parameters<typeof MikroORM.init<MongoDriver>>[0] = {
  migrations: {
    path: path.join(__dirname, "./migrations"), // path to the folder with migrations
    transactional: true, // wrap each migration in a transaction
    // pattern: /^[\w-]+\d+\.[tj]s$/, // this was causing error idk why
  },
  entities: [
    User,
    Translation,
    Book,
    Chapter,
    Verse,
    Test,
    Bookmark,
    AIMessage,
  ],
  type: "mongo",
  dbName: "daylybread",
  clientUrl: process.env.MONGODBCLIENTURL,
  debug: true,
  implicitTransactions: true,
};

export default config;
