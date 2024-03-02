import fs from "fs";
import util from "util";
import { google } from "@google-cloud/text-to-speech/build/protos/protos";
import ffmpeg from "fluent-ffmpeg";
import { MyContext } from "src/types";
import { Ctx, Query, Resolver } from "type-graphql";
import { Chapter, ITimeRange } from "../entities/Bible/Chapter";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { Translation } from "../entities/Bible/Translation";
import { Book } from "../entities/Bible/Book";
import { EntityManager } from "@mikro-orm/mongodb";
import { EntityData } from "@mikro-orm/core";

interface ITimestamp {
  start: ITimeRange;
  end: ITimeRange;
}

/**
 * Resolver to handle all audio needs.
 */
@Resolver()
export class AudioResolver {
  unlinkAsync = util.promisify(fs.unlink);

  /**
   * Function to create timestamps based on durations in seconds
   */
  createTimeStamp(duration: number) {
    // getting minutes and seconds
    let minutes = Math.floor(duration / 60);
    let extraSeconds = duration % 60;

    // generating timestamp
    minutes = minutes < 10 ? 0 + minutes : minutes;
    extraSeconds = extraSeconds < 10 ? 0 + extraSeconds : extraSeconds;

    return { minutes: minutes, seconds: extraSeconds };
  }

  /**
   * Function to creat the request obj for the google text to speech client
   */
  getGoogleTextToSpeechRequest(
    text: string
  ): google.cloud.texttospeech.v1.ISynthesizeSpeechRequest {
    return {
      input: { text: text },
      // Select the language and SSML voice gender (optional)
      voice: {
        languageCode: "en-US",
        ssmlGender: "MALE",
        name: "en-GB-Standard-D",
        // name: "en-US-Standard-J",
      },
      // select the type of audio encoding
      audioConfig: {
        audioEncoding: "MP3",
        pitch: -3,
      },
    };
  }

  // Function to delete a file asynchronously
  async deleteFile(filePath: string): Promise<void> {
    try {
      await this.unlinkAsync(filePath);
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error);
    }
  }

  /**
   * Function to create synthetic voices and attach a time stamp to each verse
   */
  @Query(() => String)
  async CreateBibleRead(
    @Ctx()
    { em, AWS }: MyContext
  ) {
    // Select a version of the Bible
    const translation = await em.findOne(Translation, { abbreviation: "KJV" });

    if (!translation) {
      // Handle the case where the translation is not found
      console.error("Translation not found.");
      return;
    }

    // Loop through each book
    for (const [bookIndex, bookFromTran] of translation.books.entries()) {
      // books to skip
      if (bookIndex <= 20) {
        console.log("skipping book: ", bookFromTran.bookName);
        continue;
      }
      // We will be converting into synthetic voicings a little at a time to not over do the budget
      // we will do the first 6 books out of 66 (this will be done after 11 times)
      if (bookIndex > 30) {
        console.log(
          `We are finished with all the books up to before ${bookFromTran.bookName}. Book number ${bookFromTran.bibleId} index ${bookIndex}`
        );
        return `We are finished with all the books up to ${bookFromTran.bookName}`;
      }

      console.log("doing book", bookFromTran.bookName);

      // Get the book
      const book = await em.findOne(Book, { bibleId: bookFromTran.bibleId });

      if (!book) {
        // Handle the case where the book is not found
        console.error(`Book with bibleId ${bookFromTran.bibleId} not found.`);
        continue; // Move on to the next iteration
      }

      // Loop through every chapter
      for (const chapterFromBook of book.chapters) {
        // Get chapter
        const chapter = await em.findOne(
          Chapter,
          {
            bibleId: chapterFromBook.bibleId,
          },
          { populate: ["verses"] }
        );

        if (chapter) {
          // Handle the audio Bible creation for the current chapter
          await this.handleAudioBibleCreation(chapter, AWS, em);
        } else {
          // Handle the case where the chapter is not found
          console.error(
            `Chapter with bibleId ${chapterFromBook.bibleId} not found.`
          );
        }
      }
    }

    return "Hello world";
  }

  private async handleAudioBibleCreation(
    chapter: Chapter,
    AWS: MyContext["AWS"],
    em: EntityManager
  ) {
    // create instance of S3
    const s3 = new AWS.S3();

    // check for a chapter obj
    if (!chapter || !chapter.verses) return;

    // create a test to speech client
    const client = new TextToSpeechClient();

    // maintain a list of all files created
    let filesToDelete: string[] = [];
    // file name where the combined audio is going to be at
    const fullAudioFileName =
      `${chapter.bookName}-${chapter.chapterNumber}.mp3`.replace(/\s/g, "_");
    // file path name where it'll be stored in S3
    const s3ObjectPathKey =
      `audio-bible/${chapter.translation.abbreviation}/${chapter.bookName}/${fullAudioFileName}`.replace(
        /\s/g,
        "_"
      );

    // Create an FFmpeg command
    const command = ffmpeg();

    // variable to keep track of the total duration time of the chapter
    let totalDurationTime = 0;

    // loop through every verse
    for (const [verseIndex, verse] of chapter.verses.entries()) {
      // initialize the timestamp object for this verse
      // include the start time
      const timestamps: ITimestamp = {
        start: this.createTimeStamp(totalDurationTime),
        end: { minutes: 0, seconds: 0 },
      };
      // create an output file name
      const outputFileName = "output" + verseIndex + ".mp3";

      // create the request for the text to speech client with configs
      const request: google.cloud.texttospeech.v1.ISynthesizeSpeechRequest =
        this.getGoogleTextToSpeechRequest(verse.text);

      try {
        // Performs the text-to-speech request
        const [response] = await client.synthesizeSpeech(request);

        // Write the binary audio content to a local file
        const writeFile = util.promisify(fs.writeFile);
        await writeFile(outputFileName, response?.audioContent!, "binary");

        // Add input options for each audio file
        command.input(outputFileName);

        // promise function to get the duration time when this verse ends
        const getFileDurationTime = () =>
          new Promise<number>((resolve, _) => {
            command.ffprobe((_, metadata) => {
              resolve((totalDurationTime += metadata.format.duration!));
            });
          });

        // get the duration of when the verse ends in relation to the duration of the chapter
        const durationEndTime = await getFileDurationTime();

        // set the end timestamp
        timestamps.end = this.createTimeStamp(durationEndTime);

        // set timestamps to verse
        verse.audioTimestamp = timestamps;
        // add file to list for use later and deletion
        filesToDelete.push(outputFileName);
      } catch (err) {
        console.log(err);
      }
    }

    // Concatenate the input audio files
    const mergePromise = new Promise<void>((resolve, reject) => {
      command
        .on("end", () => {
          resolve();
        })
        .on("error", (err) => {
          console.error("Error:", err);
          reject(err);
        })
        .mergeToFile(fullAudioFileName, "/");
    });

    // Try to run the FFmpeg command
    try {
      await mergePromise;

      // Read the audio file
      const fileContent = fs.readFileSync(fullAudioFileName);
      filesToDelete.push(fullAudioFileName);

      // create upload params
      const params: AWS.S3.PutObjectRequest = {
        Bucket: process.env.BUCKET_NAME!,
        Key: s3ObjectPathKey,
        Body: fileContent,
        ContentType: "audio/mpeg",
      };

      // Upload the file to S3
      const data = await s3.upload(params).promise();

      // Cast the update data to EntityData<Chapter>
      const updateData: EntityData<Chapter> = {
        verses: chapter.verses,
        audioLink: data.Location,
      };

      try {
        // Use nativeUpdate to update the specific field
        await em.nativeUpdate(Chapter, { _id: chapter._id }, updateData);
      } catch (err) {
        console.log(err);
      }
    } catch (err) {
      console.log("Errors: ", err);
    }

    // clean up files
    for (const audioFilePath of filesToDelete) {
      await this.deleteFile(audioFilePath);
    }

    return chapter;
  }
}
