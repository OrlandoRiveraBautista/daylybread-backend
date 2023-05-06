import App from "./app";
import dotenv from "dotenv";
import { Translation } from "./entities/Bible/Translation";
import { ExampleResolver } from "./resolvers/example";
import { TranslationResolver } from "./resolvers/Bible/TranslationResolver";
import { BookResolver } from "./resolvers/Bible/BookResolver";
import { Test } from "./entities/Test";
import { Book } from "./entities/Bible/Book";
import { Chapter } from "./entities/Bible/Chapter";
import { ChapterResolver } from "./resolvers/Bible/ChapterResolver";
import { Verse } from "./entities/Bible/Verse";
import { VerseResolver } from "./resolvers/Bible/VerseResolver";
import { OpenAiTestResolver } from "./resolvers/OpenAI/test";

/** Controllers */

dotenv.config();

const server = async () => {
  const app = new App({
    port: process.env.PORT ? Number.parseInt(process.env.PORT) : 5001,
    entities: [Translation, Book, Chapter, Verse, Test],
    resolvers: [
      ExampleResolver,
      TranslationResolver,
      BookResolver,
      ChapterResolver,
      VerseResolver,
      OpenAiTestResolver,
    ],
  });

  app.listen();
};

server().catch((err) => {
  console.error(err);
});
