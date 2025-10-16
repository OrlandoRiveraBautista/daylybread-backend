import { EntityManager, ObjectId } from "@mikro-orm/mongodb";
import {
  VideoGeneration,
  VideoStatus,
  VideoStyle,
  BackgroundType,
} from "../entities/VideoGeneration";
import { OpenAI } from "@langchain/openai";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import {
  SubtitleAnimationService,
  SubtitleStyle,
} from "./SubtitleAnimationService";

// For AWS S3 uploads (using existing infrastructure)
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export interface VideoGenerationConfig {
  verseReference: string;
  theme?: string;
  customPrompt?: string;
  style: VideoStyle;
  backgroundType: BackgroundType;
  duration: number;
  subtitleConfig?: {
    style: "dynamic" | "classic";
    colorScheme: string[];
    fontSize: number;
    fontFamily: string;
    emojis: boolean;
  };
  musicGenre?: string;
  autoPost?: boolean;
  postingPlatforms?: string[];
}

export class VideoGenerationService {
  private em: EntityManager;
  private openai: OpenAI;
  private s3Client: S3Client;
  private workDir: string;

  constructor(em: EntityManager, openai: OpenAI) {
    this.em = em;
    this.openai = openai;

    // Initialize S3 client (using existing AWS configuration)
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    // Create temporary work directory
    this.workDir = path.join(process.cwd(), "temp", "video-generation");
    if (!fs.existsSync(this.workDir)) {
      fs.mkdirSync(this.workDir, { recursive: true });
    }
  }

  /**
   * Main method to generate a complete video
   */
  async generateVideo(
    userId: string,
    config: VideoGenerationConfig
  ): Promise<VideoGeneration> {
    // Create video generation record
    const videoGeneration = new VideoGeneration();
    videoGeneration.userId = userId;
    videoGeneration.verseReference = config.verseReference;
    videoGeneration.theme = config.theme;
    videoGeneration.customPrompt = config.customPrompt;
    videoGeneration.style = config.style;
    videoGeneration.backgroundType = config.backgroundType;
    videoGeneration.duration = config.duration;
    videoGeneration.subtitleConfig = config.subtitleConfig;
    videoGeneration.musicGenre = config.musicGenre;
    videoGeneration.autoPost = config.autoPost || false;
    videoGeneration.postingPlatforms = config.postingPlatforms;
    videoGeneration.status = VideoStatus.PENDING;

    await this.em.persistAndFlush(videoGeneration);

    // Start generation process in background
    this.processVideoGeneration(videoGeneration._id.toString()).catch(
      (error) => {
        console.error("Video generation failed:", error);
        this.updateVideoStatus(
          videoGeneration._id.toString(),
          VideoStatus.FAILED,
          error.message
        );
      }
    );

    return videoGeneration;
  }

  /**
   * Process video generation pipeline
   */
  private async processVideoGeneration(videoId: string): Promise<void> {
    const video = await this.em.findOne(VideoGeneration, {
      _id: new ObjectId(videoId),
    });
    if (!video) throw new Error("Video generation not found");

    const sessionDir = path.join(this.workDir, videoId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    try {
      // Step 1: Generate script
      await this.updateVideoStatus(
        videoId,
        VideoStatus.GENERATING_SCRIPT,
        undefined,
        10
      );
      const script = await this.generateScript(video);
      video.generatedScript = script;
      await this.em.persistAndFlush(video);

      // Step 2: Generate audio (TTS)
      await this.updateVideoStatus(
        videoId,
        VideoStatus.GENERATING_AUDIO,
        undefined,
        30
      );
      const audioPath = await this.generateAudio(script, sessionDir);
      const audioUrl = await this.uploadToS3(
        audioPath,
        `videos/${videoId}/audio.mp3`
      );
      video.audioUrl = audioUrl;
      await this.em.persistAndFlush(video);

      // Step 3: Fetch background
      await this.updateVideoStatus(
        videoId,
        VideoStatus.FETCHING_BACKGROUND,
        undefined,
        50
      );
      const backgroundPath = await this.fetchBackground(video, sessionDir);
      const backgroundUrl = await this.uploadToS3(
        backgroundPath,
        `videos/${videoId}/background.mp4`
      );
      video.backgroundVideoUrl = backgroundUrl;
      await this.em.persistAndFlush(video);

      // Step 4: Render video with subtitles
      await this.updateVideoStatus(
        videoId,
        VideoStatus.RENDERING_VIDEO,
        undefined,
        70
      );
      const finalVideoPath = await this.renderFinalVideo(
        video,
        audioPath,
        backgroundPath,
        sessionDir
      );

      // Step 5: Upload final video
      await this.updateVideoStatus(
        videoId,
        VideoStatus.UPLOADING,
        undefined,
        90
      );
      const finalVideoUrl = await this.uploadToS3(
        finalVideoPath,
        `videos/${videoId}/final.mp4`
      );
      video.finalVideoUrl = finalVideoUrl;
      video.completedAt = new Date();
      await this.em.persistAndFlush(video);

      await this.updateVideoStatus(
        videoId,
        VideoStatus.COMPLETED,
        undefined,
        100
      );

      // Cleanup temporary files
      this.cleanupSession(sessionDir);
    } catch (error) {
      console.error("Video generation error:", error);
      await this.updateVideoStatus(videoId, VideoStatus.FAILED, error.message);
      this.cleanupSession(sessionDir);
      throw error;
    }
  }

  /**
   * Generate Bible story script using OpenAI
   */
  private async generateScript(video: VideoGeneration): Promise<string> {
    const basePrompt = `You are a creative content writer specializing in engaging Bible stories for social media. 
    Create a ${video.duration}-second script for ${video.verseReference}.`;

    let specificPrompt = "";
    switch (video.style) {
      case VideoStyle.TIKTOK:
        specificPrompt = `
        Write a TikTok-style script that:
        - Starts with a hook in the first 3 seconds
        - Uses modern, conversational language
        - Includes dramatic pauses and emphasis
        - Ends with a powerful takeaway
        - Is exactly ${
          video.duration
        } seconds when read aloud (about ${Math.round(
          video.duration * 2.5
        )} words)
        - Uses "you" to directly address the viewer
        `;
        break;
      case VideoStyle.INSTAGRAM_REEL:
        specificPrompt = `
        Write an Instagram Reel script that:
        - Has a compelling opening line
        - Uses storytelling techniques
        - Includes visual cues for text overlays
        - Has a clear message/lesson
        - Is ${video.duration} seconds when narrated
        `;
        break;
      case VideoStyle.YOUTUBE_SHORT:
        specificPrompt = `
        Write a YouTube Short script that:
        - Grabs attention immediately
        - Has educational value
        - Uses cliffhangers and reveals
        - Encourages engagement
        - Fits ${video.duration} seconds of narration
        `;
        break;
    }

    const themeAddition = video.theme
      ? `\nFocus on the theme: ${video.theme}`
      : "";
    const customAddition = video.customPrompt
      ? `\nCustom requirements: ${video.customPrompt}`
      : "";

    const fullPrompt = `${basePrompt}\n${specificPrompt}${themeAddition}${customAddition}

    Return only the script text, no additional formatting or explanations.`;

    const response = await this.openai.call(fullPrompt);
    return response.trim();
  }

  /**
   * Generate audio using OpenAI TTS
   */
  private async generateAudio(
    script: string,
    sessionDir: string
  ): Promise<string> {
    // Using OpenAI's TTS API
    const response = await axios.post(
      "https://api.openai.com/v1/audio/speech",
      {
        model: "tts-1",
        input: script,
        voice: "alloy", // or 'echo', 'fable', 'onyx', 'nova', 'shimmer'
        response_format: "mp3",
        speed: 1.0,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
      }
    );

    const audioPath = path.join(sessionDir, "narration.mp3");
    fs.writeFileSync(audioPath, response.data);
    return audioPath;
  }

  /**
   * Fetch background video/image based on configuration
   */
  private async fetchBackground(
    video: VideoGeneration,
    sessionDir: string
  ): Promise<string> {
    switch (video.backgroundType) {
      case BackgroundType.STOCK_FOOTAGE:
        return await this.fetchStockFootage(video.verseReference, sessionDir);
      case BackgroundType.STATIC_WITH_MOTION:
        return await this.createStaticWithMotion(
          video.verseReference,
          sessionDir
        );
      case BackgroundType.AI_GENERATED:
        // TODO: Implement AI video generation (Pika Labs/Runway via Replicate)
        return await this.fetchStockFootage(video.verseReference, sessionDir);
      default:
        return await this.fetchStockFootage(video.verseReference, sessionDir);
    }
  }

  /**
   * Fetch stock footage from Pexels API
   */
  private async fetchStockFootage(
    verseReference: string,
    sessionDir: string
  ): Promise<string> {
    // Extract keywords from verse reference for search
    const keywords = this.extractKeywordsForSearch(verseReference);

    try {
      const response = await axios.get("https://api.pexels.com/videos/search", {
        headers: {
          Authorization: process.env.PEXELS_API_KEY!,
        },
        params: {
          query: keywords,
          per_page: 10,
          orientation: "portrait", // For TikTok/Instagram format
        },
      });

      if (response.data.videos && response.data.videos.length > 0) {
        // Get first suitable video
        const video = response.data.videos[0];
        const videoFile =
          video.video_files.find(
            (file: any) => file.quality === "hd" && file.width < file.height
          ) || video.video_files[0];

        // Download video
        const videoResponse = await axios.get(videoFile.link, {
          responseType: "stream",
        });
        const videoPath = path.join(sessionDir, "background.mp4");
        const writer = fs.createWriteStream(videoPath);
        videoResponse.data.pipe(writer);

        return new Promise((resolve, reject) => {
          writer.on("finish", () => resolve(videoPath));
          writer.on("error", reject);
        });
      }
    } catch (error) {
      console.warn("Failed to fetch from Pexels, using fallback", error);
    }

    // Fallback: create simple gradient background
    return await this.createStaticWithMotion(verseReference, sessionDir);
  }

  /**
   * Create static background with motion effects
   */
  private async createStaticWithMotion(
    _verseReference: string,
    sessionDir: string
  ): Promise<string> {
    // Create a simple animated background using canvas and ffmpeg
    const width = 1080;
    const height = 1920; // TikTok/Instagram ratio

    // Create base image with gradient
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#667eea");
    gradient.addColorStop(1, "#764ba2");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add some decorative elements
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const radius = Math.random() * 100 + 50;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Save base image
    const buffer = canvas.toBuffer("image/png");
    const imagePath = path.join(sessionDir, "background.png");
    fs.writeFileSync(imagePath, buffer);

    // Convert to video with subtle zoom effect
    const videoPath = path.join(sessionDir, "background.mp4");

    return new Promise((resolve, reject) => {
      ffmpeg(imagePath)
        .inputOptions(["-loop 1", "-t 60"]) // Loop image for 60 seconds
        .videoFilters([
          "scale=1080:1920",
          "zoompan=z='1+0.0015*on':d=25*60:s=1080x1920", // Subtle zoom effect
        ])
        .outputOptions(["-c:v libx264", "-pix_fmt yuv420p", "-r 25"])
        .output(videoPath)
        .on("end", () => resolve(videoPath))
        .on("error", reject)
        .run();
    });
  }

  /**
   * Render final video with audio, background, and subtitles
   */
  private async renderFinalVideo(
    video: VideoGeneration,
    audioPath: string,
    backgroundPath: string,
    sessionDir: string
  ): Promise<string> {
    const outputPath = path.join(sessionDir, "final.mp4");

    // Get audio length for proper subtitle timing
    const audioLength = await this.getAudioLength(audioPath);

    // Create subtitle file
    const subtitlePath = await this.generateSubtitleFile(
      video.generatedScript!,
      sessionDir,
      audioLength,
      video.subtitleConfig
    );

    return new Promise((resolve, reject) => {
      let command = ffmpeg(backgroundPath)
        .input(audioPath)
        .videoFilters([
          "scale=1080:1920", // Ensure correct aspect ratio
          `subtitles=${subtitlePath}:force_style='FontSize=24,PrimaryColour=&Hffffff,BackColour=&H80000000,Bold=1,Alignment=2'`,
        ])
        .outputOptions([
          "-c:v libx264",
          "-c:a aac",
          "-shortest", // End when shortest input ends
          "-pix_fmt yuv420p",
          "-movflags +faststart",
        ])
        .output(outputPath)
        .on("end", () => resolve(outputPath))
        .on("error", reject);

      // Add background music if specified
      if (video.musicGenre && video.musicUrl) {
        // TODO: Mix background music at lower volume
      }

      command.run();
    });
  }

  /**
   * Generate subtitle file with advanced styling
   */
  private async generateSubtitleFile(
    script: string,
    sessionDir: string,
    audioLength: number,
    subtitleConfig?: any
  ): Promise<string> {
    const subtitleService = new SubtitleAnimationService(sessionDir);

    // Default subtitle style for TikTok-like videos
    const defaultStyle: SubtitleStyle = {
      style: "dynamic",
      colorScheme: ["#FFFFFF", "#FFFF00", "#FF6B6B"],
      fontSize: 48,
      fontFamily: "Arial Black",
      emojis: true,
      animation: "slideUp",
      background: "shadow",
      position: "bottom",
    };

    // Merge with user configuration
    const style: SubtitleStyle = subtitleConfig
      ? { ...defaultStyle, ...subtitleConfig }
      : defaultStyle;

    // Generate animated subtitles
    return await subtitleService.generateAnimatedSubtitles(
      script,
      audioLength,
      style,
      sessionDir
    );
  }

  /**
   * Get audio file length in seconds
   */
  private async getAudioLength(audioPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata.format.duration || 60); // Default to 60 seconds if unable to determine
      });
    });
  }

  /**
   * Extract keywords from verse reference for search
   */
  private extractKeywordsForSearch(verseReference: string): string {
    const biblicalKeywords: { [key: string]: string } = {
      genesis: "creation nature light",
      david: "warrior shepherd fields",
      goliath: "battle strength courage",
      "john 3:16": "love light hope",
      "psalm 23": "peaceful valley shepherd",
      "matthew 5": "mountain sermon teaching",
      "luke 2": "baby birth star",
      "romans 8": "victory freedom joy",
      revelation: "heaven golden light",
      noah: "ark rainbow storm",
      moses: "desert mountain fire",
      jesus: "peaceful light healing",
      paul: "journey roads travel",
      mary: "gentle mother peaceful",
      peter: "ocean fishing boat",
    };

    const lowerRef = verseReference.toLowerCase();
    for (const [key, keywords] of Object.entries(biblicalKeywords)) {
      if (lowerRef.includes(key)) {
        return keywords;
      }
    }

    return "peaceful nature spiritual light"; // Default fallback
  }

  /**
   * Upload file to S3
   */
  private async uploadToS3(filePath: string, key: string): Promise<string> {
    const fileContent = fs.readFileSync(filePath);

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      Body: fileContent,
      ContentType: this.getContentType(filePath),
    });

    await this.s3Client.send(command);

    return `https://${process.env.AWS_S3_BUCKET}.s3.${
      process.env.AWS_REGION || "us-east-1"
    }.amazonaws.com/${key}`;
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case ".mp4":
        return "video/mp4";
      case ".mp3":
        return "audio/mpeg";
      case ".png":
        return "image/png";
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      default:
        return "application/octet-stream";
    }
  }

  /**
   * Update video generation status
   */
  private async updateVideoStatus(
    videoId: string,
    status: VideoStatus,
    errorMessage?: string,
    progress?: number
  ): Promise<void> {
    const video = await this.em.findOne(VideoGeneration, {
      _id: new ObjectId(videoId),
    });
    if (!video) return;

    video.status = status;
    if (errorMessage) video.errorMessage = errorMessage;
    if (progress !== undefined) video.progress = progress;
    video.updatedAt = new Date();

    await this.em.persistAndFlush(video);
  }

  /**
   * Cleanup session directory
   */
  private cleanupSession(sessionDir: string): void {
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn("Failed to cleanup session directory:", error);
    }
  }

  /**
   * Get video generation by ID
   */
  async getVideoGeneration(videoId: string): Promise<VideoGeneration | null> {
    return await this.em.findOne(VideoGeneration, {
      _id: new ObjectId(videoId),
    });
  }

  /**
   * Get user's video generations
   */
  async getUserVideoGenerations(
    userId: string,
    limit: number = 20
  ): Promise<VideoGeneration[]> {
    return await this.em.find(
      VideoGeneration,
      { userId },
      {
        orderBy: { createdAt: -1 },
        limit,
      }
    );
  }

  /**
   * Cancel video generation
   */
  async cancelVideoGeneration(videoId: string): Promise<boolean> {
    const video = await this.em.findOne(VideoGeneration, {
      _id: new ObjectId(videoId),
    });
    if (!video || video.status === VideoStatus.COMPLETED) {
      return false;
    }

    video.status = VideoStatus.FAILED;
    video.errorMessage = "Cancelled by user";
    await this.em.persistAndFlush(video);

    return true;
  }
}
