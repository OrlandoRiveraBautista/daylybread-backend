import App from "./app";
import dotenv from "dotenv";

/* Entities */
import { User } from "./entities/User";
import { Translation } from "./entities/Bible/Translation";
import { Test } from "./entities/Test";
import { Book } from "./entities/Bible/Book";
import { Chapter } from "./entities/Bible/Chapter";
import { Verse } from "./entities/Bible/Verse";
import { Bookmark } from "./entities/Bookmark";
import { AIMessage } from "./entities/AIMemory";

/* Resolvers */
import { ExampleResolver } from "./resolvers/example";
import { TranslationResolver } from "./resolvers/Bible/TranslationResolver";
import { BookResolver } from "./resolvers/Bible/BookResolver";
import { ChapterResolver } from "./resolvers/Bible/ChapterResolver";
import { VerseResolver } from "./resolvers/Bible/VerseResolver";
import { OpenAiTestResolver } from "./resolvers/OpenAI/test";
import { AuthResolver } from "./resolvers/AuthResolver";
import { UserResolver } from "./resolvers/UserResolver";
import { BookmarkResolver } from "./resolvers/BookmarkResolver";

dotenv.config();

const server = async () => {
  const app = new App({
    port: process.env.PORT ? Number.parseInt(process.env.PORT) : 5001,
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
    resolvers: [
      ExampleResolver,
      AuthResolver,
      TranslationResolver,
      BookResolver,
      ChapterResolver,
      VerseResolver,
      OpenAiTestResolver,
      UserResolver,
      BookmarkResolver,
    ],
  });

  app.listen();
};

server().catch((err) => {
  console.error(err);
});
