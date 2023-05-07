import { MyContext } from "src/types";
import { Translation, TranslationBook } from "../../entities/Bible/Translation";
import { Book } from "../../entities/Bible/Book";
import { Resolver, Query, Ctx, Arg } from "type-graphql";
import { ObjectId } from "@mikro-orm/mongodb";
import { FieldError } from "../../entities/Errors/FieldError";

@Resolver()
export class BookResolver {
  // Get all of the books from by translation id
  @Query(() => [TranslationBook])
  async getBooks(
    @Arg("translationId", () => String) id: ObjectId,
    @Ctx() { em, chatgpt }: MyContext
  ): Promise<TranslationBook[] | FieldError> {
    // find translation
    const results = await em.findOne(Translation, { _id: id });

    if (!results) {
      const error: FieldError = {
        message: "Bible could not be found. Please try a different one",
      };
      return error;
    }

    // get books
    const books = results.books;

    // call ai with prompt text
    const response = await chatgpt.call({
      input: "hello",
    });

    console.log("Response:");
    console.log(response);

    return books;
  }

  // Get a book from translation id and book name
  @Query(() => Book)
  async getBookByName(
    @Arg("translationId", () => String) id: ObjectId,
    @Arg("bookName", () => String) name: string,
    @Ctx() { em }: MyContext
  ): Promise<Book | FieldError> {
    // find translation
    const results = await em.findOne(Translation, {
      _id: id,
    });

    // check that we have the translation
    if (!results) {
      const error: FieldError = {
        message: "Bible could not be found. Please try a different one",
      };
      return error;
    }

    // get the correct book
    const book = results.books.filter(
      (book) =>
        book.bookName.normalize("NFD").replace(/\p{Diacritic}/gu, "") === name
    )[0];

    // check if the book was found
    if (!book || !book.bookName) {
      const error: FieldError = {
        message: "Book could not be found. Please try a different one",
      };
      return error;
    }

    const bookDetails = await em.findOne(Book, {
      bibleId: book.bibleId,
    });

    // check if the book was found
    if (!bookDetails || !bookDetails.bookName) {
      const error: FieldError = {
        message: "Book could not be found. Please try a different one",
      };
      return error;
    }

    // return book
    return bookDetails;
  }

  // Get a book from translation id and book name
  @Query(() => Book)
  async getBookById(
    @Arg("bibleId", () => String) id: string,
    @Ctx() { em }: MyContext
  ): Promise<Book | FieldError> {
    // find book with bible id
    const results = await em.findOne(Book, {
      bibleId: id,
    });

    // check book was found
    if (!results) {
      const error: FieldError = {
        message: "Book could not be found. Please try a different one",
      };
      return error;
    }

    // return book
    return results;
  }

  // Get a chapter from translation id, book name, and chapter number
  // @Query(() => Chapter)
  // async getChapter(
  //   @Arg("translationId", () => String) id: ObjectId,
  //   @Arg("bookName", () => String) name: string,
  //   @Arg("chapterNumber", () => String) number: string,
  //   @Ctx() { em }: MyContext
  // ): Promise<Chapter | FieldError> {
  //   // find translation
  //   const results = await em.findOne(Translation, {
  //     _id: id,
  //   });

  //   // check that we have the translation
  //   if (!results) {
  //     const error: FieldError = {
  //       message: "Bible could not be found. Please try a different one",
  //     };
  //     return error;
  //   }

  //   // get the correct book
  //   const book = results.bible.books.find(
  //     (book) =>
  //       book.name.normalize("NFD").replace(/\p{Diacritic}/gu, "") === name
  //   );

  //   // check if the book was found
  //   if (!book || !book.name) {
  //     const error: FieldError = {
  //       message: "Book could not be found. Please try a different one",
  //     };
  //     return error;
  //   }

  //   const chapter = book.chapters.find((chapter) => chapter.chapter == number);

  //   // check if the book was found
  //   if (!chapter || !chapter.verses.length) {
  //     const error: FieldError = {
  //       message: "Book could not be found. Please try a different one",
  //     };
  //     return error;
  //   }

  //   // return book
  //   return chapter;
  // }
}
