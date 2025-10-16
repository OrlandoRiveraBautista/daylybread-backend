import { EntityManager, ObjectId } from "@mikro-orm/mongodb";
import {
  VideoGeneration,
  VideoStatus,
  VideoStyle,
  BackgroundType,
} from "../entities/VideoGeneration";
import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  FewShotPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { LLMChain } from "langchain/chains";
import { RunnableSequence } from "@langchain/core/runnables";
import {
  StructuredOutputParser,
  OutputFixingParser,
} from "langchain/output_parsers";
import { BufferWindowMemory } from "langchain/memory";
import { z } from "zod";
import { CallbackManager } from "@langchain/core/callbacks/manager";
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

// Zod schemas for structured output
const ScriptOutputSchema = z.object({
  script: z
    .string()
    .min(30)
    .max(1000)
    .describe("The complete narration script"),
  keyMoments: z
    .array(
      z.object({
        timestamp: z.number().describe("Time in seconds"),
        text: z.string().describe("Key phrase or moment"),
        emphasis: z.boolean().describe("Whether this should be emphasized"),
      })
    )
    .describe("Key moments for emphasis and timing"),
  estimatedDuration: z
    .number()
    .min(15)
    .max(120)
    .describe("Estimated speaking duration in seconds"),
  hook: z.string().max(100).describe("Opening hook (first 3 seconds)"),
  callToAction: z.string().max(80).describe("Closing call to action"),
  keywords: z
    .array(z.string())
    .max(10)
    .describe("Keywords for background search"),
  emotionalTone: z
    .enum([
      "inspirational",
      "dramatic",
      "peaceful",
      "energetic",
      "contemplative",
    ])
    .describe("Overall emotional tone"),
});

const BackgroundSuggestionSchema = z.object({
  primaryKeywords: z
    .array(z.string())
    .max(5)
    .describe("Main visual keywords for search"),
  secondaryKeywords: z.array(z.string()).max(5).describe("Fallback keywords"),
  mood: z.string().describe("Visual mood and atmosphere"),
  colorPalette: z.array(z.string()).max(5).describe("Suggested color scheme"),
  visualStyle: z
    .enum(["cinematic", "peaceful", "dramatic", "modern", "classical"])
    .describe("Visual style preference"),
  motionType: z
    .enum(["slow", "medium", "fast", "static"])
    .describe("Preferred motion speed"),
  timeOfDay: z
    .enum(["dawn", "day", "sunset", "night", "any"])
    .optional()
    .describe("Preferred time of day if relevant"),
});

const QualityAssessmentSchema = z.object({
  theologicalAccuracy: z
    .number()
    .min(1)
    .max(10)
    .describe("Theological accuracy score"),
  engagementPotential: z
    .number()
    .min(1)
    .max(10)
    .describe("Predicted engagement score"),
  platformOptimization: z
    .number()
    .min(1)
    .max(10)
    .describe("Platform-specific optimization score"),
  overallQuality: z.number().min(1).max(10).describe("Overall content quality"),
  suggestions: z
    .array(z.string())
    .max(5)
    .describe("Specific improvement suggestions"),
  approved: z.boolean().describe("Whether content meets quality standards"),
});

export interface LangChainVideoConfig {
  verseReference: string;
  theme?: string;
  customPrompt?: string;
  style: VideoStyle;
  backgroundType: BackgroundType;
  duration: number;
  subtitleConfig?: SubtitleStyle;
  musicGenre?: string;
  autoPost?: boolean;
  postingPlatforms?: string[];
  qualityThreshold?: number; // Minimum quality score to proceed
}

export class LangChainVideoGenerationService {
  private em: EntityManager;
  private llm: ChatOpenAI;
  private s3Client: S3Client;
  private workDir: string;

  // LangChain chains
  private scriptChain: LLMChain;
  private backgroundChain: LLMChain;
  private qualityChain: LLMChain;
  private fullPipeline: RunnableSequence;

  // Memory for user preferences
  private userMemory: BufferWindowMemory;

  constructor(em: EntityManager) {
    this.em = em;

    // Initialize ChatOpenAI with proper configuration
    this.llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.7, // Slightly creative for varied content
      openAIApiKey: process.env.OPENAI_API_KEY,
      maxTokens: 1000,
    });

    // Initialize S3 client
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

    // Initialize memory for user preferences
    this.userMemory = new BufferWindowMemory({
      memoryKey: "user_video_history",
      returnMessages: true,
      k: 5, // Remember last 5 interactions
    });

    // Initialize chains
    this.initializeChains();
  }

  /**
   * Initialize all LangChain chains
   */
  private initializeChains(): void {
    // Script generation chain with few-shot examples
    this.scriptChain = new LLMChain({
      llm: this.llm,
      prompt: this.createScriptPrompt(),
      outputParser: new OutputFixingParser({
        parser: StructuredOutputParser.fromZodSchema(ScriptOutputSchema),
        retryChain: LLMChain.fromLLM(this.llm, this.createFixingPrompt()),
      }),
    });

    // Background suggestion chain
    this.backgroundChain = new LLMChain({
      llm: this.llm,
      prompt: this.createBackgroundPrompt(),
      outputParser: StructuredOutputParser.fromZodSchema(
        BackgroundSuggestionSchema
      ),
    });

    // Quality assurance chain
    this.qualityChain = new LLMChain({
      llm: this.llm,
      prompt: this.createQualityPrompt(),
      outputParser: StructuredOutputParser.fromZodSchema(
        QualityAssessmentSchema
      ),
    });

    // Full pipeline chain using modern RunnableSequence
    this.fullPipeline = RunnableSequence.from([
      this.scriptChain,
      this.backgroundChain,
      this.qualityChain,
    ]);
  }

  /**
   * Create script generation prompt with few-shot examples
   */
  private createScriptPrompt(): FewShotPromptTemplate {
    const examples = [
      {
        verseReference: "John 3:16",
        style: "tiktok",
        duration: "45",
        theme: "God's Love",
        output: `{
          "script": "Wait... did you know there's ONE verse that literally changed EVERYTHING? 🌟 John 3:16 says God loved the world SO much that He gave His only Son. Think about that - the Creator of the universe... loves YOU that much. That's not just love, that's RADICAL love. A love so big it moved heaven to earth. So the next time you doubt your worth, remember this: you are Heaven's treasured possession. ❤️",
          "keyMoments": [
            {"timestamp": 2, "text": "ONE verse that changed EVERYTHING", "emphasis": true},
            {"timestamp": 15, "text": "God loved the world SO much", "emphasis": true},
            {"timestamp": 35, "text": "you are Heaven's treasured possession", "emphasis": true}
          ],
          "estimatedDuration": 43,
          "hook": "Wait... did you know there's ONE verse that literally changed EVERYTHING?",
          "callToAction": "Remember: you are Heaven's treasured possession ❤️",
          "keywords": ["love", "heart", "light", "heaven", "embrace"],
          "emotionalTone": "inspirational"
        }`,
      },
      {
        verseReference: "Philippians 4:13",
        style: "instagram_reel",
        duration: "60",
        theme: "Strength",
        output: `{
          "script": "Feeling weak? Overwhelmed? Like you can't handle what's ahead? 💪 Here's what Paul discovered in prison - literal chains couldn't chain his spirit. Philippians 4:13: 'I can do all things through Christ who strengthens me.' Not 'some things' - ALL things. That job interview? You've got this. That difficult conversation? You've got this. That mountain you're facing? You've got divine strength flowing through you right now. You're not fighting alone - you're fighting with Heaven's power. 🔥",
          "keyMoments": [
            {"timestamp": 8, "text": "literal chains couldn't chain his spirit", "emphasis": true},
            {"timestamp": 25, "text": "ALL things", "emphasis": true},
            {"timestamp": 50, "text": "You're fighting with Heaven's power", "emphasis": true}
          ],
          "estimatedDuration": 58,
          "hook": "Feeling weak? Overwhelmed? Like you can't handle what's ahead?",
          "callToAction": "You're fighting with Heaven's power 🔥",
          "keywords": ["strength", "power", "victory", "determination", "breakthrough"],
          "emotionalTone": "energetic"
        }`,
      },
    ];

    const examplePrompt = ChatPromptTemplate.fromTemplate(`
      Verse: {verseReference}
      Style: {style}  
      Duration: {duration}s
      Theme: {theme}
      Output: {output}
    `);

    return new FewShotPromptTemplate({
      examples,
      examplePrompt,
      prefix: `You are a master content creator specializing in viral Bible content for social media. Create engaging, theologically accurate scripts that hook viewers immediately and deliver profound truth in digestible format.

      CRITICAL REQUIREMENTS:
      - Hook viewers in first 3 seconds with compelling question or statement
      - Use conversational, modern language that resonates with young adults
      - Include strategic pauses and emphasis points
      - End with memorable takeaway or call to action
      - Maintain biblical accuracy while being culturally relevant
      - Include emojis strategically for social media appeal
      
      Output must be valid JSON matching the specified schema.`,
      suffix: `
        Verse: {verseReference}
        Style: {style}
        Duration: {duration}s
        Theme: {theme}
        Custom Requirements: {customPrompt}
        
        Generate an engaging script that will captivate viewers and deliver biblical truth powerfully:`,
      inputVariables: [
        "verseReference",
        "style",
        "duration",
        "theme",
        "customPrompt",
      ],
    });
  }

  /**
   * Create background suggestion prompt
   */
  private createBackgroundPrompt(): ChatPromptTemplate {
    return ChatPromptTemplate.fromPromptMessages([
      SystemMessagePromptTemplate.fromTemplate(`
        You are a professional video cinematographer specializing in biblical content. Analyze scripts and suggest optimal visual backgrounds that enhance the spiritual message.

        Consider:
        - Biblical symbolism and metaphors in the verse
        - Emotional tone and mood of the script
        - Target platform visual preferences
        - Symbolic colors and their biblical meanings
        - Natural imagery that supports the message

        Always suggest visuals that:
        - Complement rather than distract from the message
        - Are appropriate for the emotional tone
        - Work well with text overlays
        - Appeal to the target demographic
      `),
      HumanMessagePromptTemplate.fromTemplate(`
        Script: {script_output}
        Verse: {verseReference}
        Style: {style}
        
        Suggest optimal background visuals for this Bible video:
      `),
    ]);
  }

  /**
   * Create quality assurance prompt
   */
  private createQualityPrompt(): ChatPromptTemplate {
    return ChatPromptTemplate.fromPromptMessages([
      SystemMessagePromptTemplate.fromTemplate(`
        You are a biblical content quality reviewer with expertise in theology and social media engagement. Evaluate content for:

        THEOLOGICAL ACCURACY (1-10):
        - Correct biblical interpretation
        - Appropriate context and application
        - Doctrinally sound message

        ENGAGEMENT POTENTIAL (1-10):
        - Hook effectiveness
        - Pacing and flow
        - Call to action strength
        - Social media optimization

        PLATFORM OPTIMIZATION (1-10):
        - Appropriate length for platform
        - Language and tone for target audience
        - Visual compatibility

        Provide specific, actionable feedback for improvement.
        Approve content only if it meets high standards (7+ in all categories).
      `),
      HumanMessagePromptTemplate.fromTemplate(`
        Verse: {verseReference}
        Script: {script_output}
        Background Suggestions: {background_output}
        Target Platform: {style}
        Duration: {duration}s
        
        Evaluate this Bible video content:
      `),
    ]);
  }

  /**
   * Create fixing prompt for malformed outputs
   */
  private createFixingPrompt(): ChatPromptTemplate {
    return ChatPromptTemplate.fromTemplate(`
      The following JSON output has formatting issues. Please fix it to match the required schema:
      
      Original output: {completion}
      Error: {error}
      
      Return only the corrected JSON:
    `);
  }

  /**
   * Main method to generate a complete video using LangChain
   */
  async generateVideo(
    userId: string,
    config: LangChainVideoConfig
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

    // Start generation process
    this.processLangChainVideoGeneration(
      videoGeneration._id.toString(),
      config
    ).catch((error) => {
      console.error("LangChain video generation failed:", error);
      this.updateVideoStatus(
        videoGeneration._id.toString(),
        VideoStatus.FAILED,
        error.message
      );
    });

    return videoGeneration;
  }

  /**
   * Process video generation using LangChain pipeline
   */
  private async processLangChainVideoGeneration(
    videoId: string,
    config: LangChainVideoConfig
  ): Promise<void> {
    const video = await this.em.findOne(VideoGeneration, {
      _id: new ObjectId(videoId),
    });
    if (!video) throw new Error("Video generation not found");

    const sessionDir = path.join(this.workDir, videoId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    try {
      // Step 1: Run LangChain pipeline for content generation
      await this.updateVideoStatus(
        videoId,
        VideoStatus.GENERATING_SCRIPT,
        undefined,
        10
      );

      // Run pipeline sequentially with modern approach
      const inputParams = {
        verseReference: config.verseReference,
        theme: config.theme || "",
        customPrompt: config.customPrompt || "",
        style: config.style,
        duration: config.duration,
      };

      const scriptOutput = await this.scriptChain.call(inputParams);
      const backgroundOutput = await this.backgroundChain.call({
        ...inputParams,
        script_output: scriptOutput,
      });
      const qualityOutput = await this.qualityChain.call({
        ...inputParams,
        script_output: scriptOutput,
        background_output: backgroundOutput,
      });

      // Quality check
      if (
        !qualityOutput.approved ||
        qualityOutput.overallQuality < (config.qualityThreshold || 7)
      ) {
        throw new Error(
          `Content quality insufficient: ${qualityOutput.suggestions.join(
            ", "
          )}`
        );
      }

      // Store generated script
      video.generatedScript = scriptOutput.script;
      video.metadata = {
        ...video.metadata,
        scriptAnalysis: scriptOutput,
        backgroundSuggestions: backgroundOutput,
        qualityAssessment: qualityOutput,
      };
      await this.em.persistAndFlush(video);

      // Step 2: Generate audio using enhanced script
      await this.updateVideoStatus(
        videoId,
        VideoStatus.GENERATING_AUDIO,
        undefined,
        30
      );
      const audioPath = await this.generateEnhancedAudio(
        scriptOutput,
        sessionDir
      );
      const audioUrl = await this.uploadToS3(
        audioPath,
        `videos/${videoId}/audio.mp3`
      );
      video.audioUrl = audioUrl;
      await this.em.persistAndFlush(video);

      // Step 3: Fetch optimized background
      await this.updateVideoStatus(
        videoId,
        VideoStatus.FETCHING_BACKGROUND,
        undefined,
        50
      );
      const backgroundPath = await this.fetchOptimizedBackground(
        backgroundOutput,
        config.backgroundType,
        sessionDir
      );
      const backgroundUrl = await this.uploadToS3(
        backgroundPath,
        `videos/${videoId}/background.mp4`
      );
      video.backgroundVideoUrl = backgroundUrl;
      await this.em.persistAndFlush(video);

      // Step 4: Render final video with enhanced subtitles
      await this.updateVideoStatus(
        videoId,
        VideoStatus.RENDERING_VIDEO,
        undefined,
        70
      );
      const finalVideoPath = await this.renderEnhancedVideo(
        video,
        scriptOutput,
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

      // Cleanup
      this.cleanupSession(sessionDir);
    } catch (error) {
      console.error("LangChain video generation error:", error);
      await this.updateVideoStatus(videoId, VideoStatus.FAILED, error.message);
      this.cleanupSession(sessionDir);
      throw error;
    }
  }

  /**
   * Generate enhanced audio with better pacing
   */
  private async generateEnhancedAudio(
    scriptOutput: any,
    sessionDir: string
  ): Promise<string> {
    // Use key moments for better pacing
    const enhancedScript = this.addPacingToScript(
      scriptOutput.script,
      scriptOutput.keyMoments
    );

    const response = await axios.post(
      "https://api.openai.com/v1/audio/speech",
      {
        model: "tts-1-hd", // Higher quality for final videos
        input: enhancedScript,
        voice: "nova", // More engaging voice
        response_format: "mp3",
        speed: 0.95, // Slightly slower for better comprehension
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
      }
    );

    const audioPath = path.join(sessionDir, "enhanced_narration.mp3");
    fs.writeFileSync(audioPath, response.data);
    return audioPath;
  }

  /**
   * Add pacing markers to script based on key moments
   */
  private addPacingToScript(script: string, keyMoments: any[]): string {
    let enhancedScript = script;

    // Add strategic pauses at key moments
    keyMoments.forEach((moment) => {
      if (moment.emphasis) {
        // Add slight pause before emphasized text for impact
        enhancedScript = enhancedScript.replace(
          moment.text,
          `... ${moment.text}`
        );
      }
    });

    return enhancedScript;
  }

  /**
   * Fetch background using AI-suggested keywords
   */
  private async fetchOptimizedBackground(
    backgroundSuggestion: any,
    backgroundType: BackgroundType,
    sessionDir: string
  ): Promise<string> {
    switch (backgroundType) {
      case BackgroundType.STOCK_FOOTAGE:
        return await this.fetchAIOptimizedFootage(
          backgroundSuggestion,
          sessionDir
        );
      case BackgroundType.STATIC_WITH_MOTION:
        return await this.createAIStyledBackground(
          backgroundSuggestion,
          sessionDir
        );
      default:
        return await this.fetchAIOptimizedFootage(
          backgroundSuggestion,
          sessionDir
        );
    }
  }

  /**
   * Fetch stock footage using AI-optimized keywords
   */
  private async fetchAIOptimizedFootage(
    backgroundSuggestion: any,
    sessionDir: string
  ): Promise<string> {
    const keywords = backgroundSuggestion.primaryKeywords.join(" ");

    try {
      const response = await axios.get("https://api.pexels.com/videos/search", {
        headers: {
          Authorization: process.env.PEXELS_API_KEY!,
        },
        params: {
          query: keywords,
          per_page: 15, // More options for better selection
          orientation: "portrait",
          size: "medium",
        },
      });

      if (response.data.videos && response.data.videos.length > 0) {
        // Use AI-suggested criteria to pick best video
        const bestVideo = this.selectBestVideo(
          response.data.videos,
          backgroundSuggestion
        );
        const videoFile =
          bestVideo.video_files.find(
            (file: any) => file.quality === "hd" && file.width < file.height
          ) || bestVideo.video_files[0];

        const videoResponse = await axios.get(videoFile.link, {
          responseType: "stream",
        });
        const videoPath = path.join(sessionDir, "ai_optimized_background.mp4");
        const writer = fs.createWriteStream(videoPath);
        videoResponse.data.pipe(writer);

        return new Promise((resolve, reject) => {
          writer.on("finish", () => resolve(videoPath));
          writer.on("error", reject);
        });
      }
    } catch (error) {
      console.warn(
        "Failed to fetch AI-optimized footage, using fallback",
        error
      );
    }

    // Fallback to styled background
    return await this.createAIStyledBackground(
      backgroundSuggestion,
      sessionDir
    );
  }

  /**
   * Select best video based on AI suggestions
   */
  private selectBestVideo(videos: any[], backgroundSuggestion: any): any {
    // Simple scoring based on duration, quality, and keywords
    return videos.reduce((best, current) => {
      const currentScore = this.scoreVideo(current, backgroundSuggestion);
      const bestScore = this.scoreVideo(best, backgroundSuggestion);
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Score video based on AI suggestions
   */
  private scoreVideo(video: any, backgroundSuggestion: any): number {
    let score = 0;

    // Prefer videos with appropriate duration (15-60 seconds)
    if (video.duration >= 15 && video.duration <= 60) score += 3;

    // Check if tags match our keywords
    const videoTags =
      video.tags?.map((tag: any) => tag.name.toLowerCase()) || [];
    backgroundSuggestion.primaryKeywords.forEach((keyword: string) => {
      if (
        videoTags.some((tag: string) => tag.includes(keyword.toLowerCase()))
      ) {
        score += 2;
      }
    });

    return score;
  }

  /**
   * Create AI-styled background with suggested colors and mood
   */
  private async createAIStyledBackground(
    backgroundSuggestion: any,
    sessionDir: string
  ): Promise<string> {
    const width = 1080;
    const height = 1920;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Use AI-suggested color palette
    const colors =
      backgroundSuggestion.colorPalette.length > 0
        ? backgroundSuggestion.colorPalette
        : ["#667eea", "#764ba2"];

    // Create gradient based on mood
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    colors.forEach((color: string, index: number) => {
      gradient.addColorStop(index / (colors.length - 1), color);
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add mood-appropriate elements
    this.addMoodElements(ctx, backgroundSuggestion.mood, width, height);

    const buffer = canvas.toBuffer("image/png");
    const imagePath = path.join(sessionDir, "ai_styled_background.png");
    fs.writeFileSync(imagePath, buffer);

    // Convert to video with motion based on AI suggestion
    const motionSpeed = this.getMotionSpeed(backgroundSuggestion.motionType);
    const videoPath = path.join(sessionDir, "ai_styled_background.mp4");

    return new Promise((resolve, reject) => {
      ffmpeg(imagePath)
        .inputOptions(["-loop 1", "-t 60"])
        .videoFilters([
          "scale=1080:1920",
          `zoompan=z='1+${motionSpeed}*on':d=25*60:s=1080x1920`,
        ])
        .outputOptions(["-c:v libx264", "-pix_fmt yuv420p", "-r 25"])
        .output(videoPath)
        .on("end", () => resolve(videoPath))
        .on("error", reject)
        .run();
    });
  }

  /**
   * Add mood-appropriate visual elements
   */
  private addMoodElements(
    ctx: any,
    mood: string,
    width: number,
    height: number
  ): void {
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";

    switch (mood.toLowerCase()) {
      case "peaceful":
        // Soft circles
        for (let i = 0; i < 10; i++) {
          const x = Math.random() * width;
          const y = Math.random() * height;
          const radius = Math.random() * 80 + 40;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case "dramatic":
        // Angular shapes
        for (let i = 0; i < 8; i++) {
          ctx.beginPath();
          ctx.moveTo(Math.random() * width, Math.random() * height);
          ctx.lineTo(Math.random() * width, Math.random() * height);
          ctx.lineTo(Math.random() * width, Math.random() * height);
          ctx.closePath();
          ctx.fill();
        }
        break;
      default:
        // Default soft elements
        for (let i = 0; i < 15; i++) {
          const x = Math.random() * width;
          const y = Math.random() * height;
          const radius = Math.random() * 60 + 30;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
    }
  }

  /**
   * Get motion speed based on AI suggestion
   */
  private getMotionSpeed(motionType: string): number {
    switch (motionType) {
      case "slow":
        return 0.0005;
      case "medium":
        return 0.0015;
      case "fast":
        return 0.003;
      case "static":
        return 0;
      default:
        return 0.0015;
    }
  }

  /**
   * Render enhanced video with AI-optimized timing
   */
  private async renderEnhancedVideo(
    video: VideoGeneration,
    scriptOutput: any,
    audioPath: string,
    backgroundPath: string,
    sessionDir: string
  ): Promise<string> {
    const outputPath = path.join(sessionDir, "enhanced_final.mp4");

    // Get audio length for proper timing
    const audioLength = await this.getAudioLength(audioPath);

    // Generate enhanced subtitles using key moments
    const subtitlePath = await this.generateEnhancedSubtitles(
      scriptOutput,
      audioLength,
      video.subtitleConfig,
      sessionDir
    );

    return new Promise((resolve, reject) => {
      ffmpeg(backgroundPath)
        .input(audioPath)
        .videoFilters([
          "scale=1080:1920",
          `subtitles=${subtitlePath}:force_style='FontSize=32,PrimaryColour=&Hffffff,BackColour=&H80000000,Bold=1,Alignment=2'`,
        ])
        .outputOptions([
          "-c:v libx264",
          "-c:a aac",
          "-shortest",
          "-pix_fmt yuv420p",
          "-movflags +faststart",
          "-profile:v baseline", // Better compatibility
          "-level 3.0",
        ])
        .output(outputPath)
        .on("end", () => resolve(outputPath))
        .on("error", reject)
        .run();
    });
  }

  /**
   * Generate enhanced subtitles using key moments from AI analysis
   */
  private async generateEnhancedSubtitles(
    scriptOutput: any,
    audioLength: number,
    subtitleConfig: any,
    sessionDir: string
  ): Promise<string> {
    const subtitleService = new SubtitleAnimationService(sessionDir);

    // Enhanced subtitle style based on AI analysis
    const enhancedStyle: SubtitleStyle = {
      style: "dynamic",
      colorScheme: this.getEmotionalColors(scriptOutput.emotionalTone),
      fontSize: 52,
      fontFamily: "Arial Black",
      emojis: true,
      animation: this.getAnimationForTone(scriptOutput.emotionalTone),
      background: "shadow",
      position: "bottom",
      ...subtitleConfig,
    };

    return await subtitleService.generateAnimatedSubtitles(
      scriptOutput.script,
      audioLength,
      enhancedStyle,
      sessionDir
    );
  }

  /**
   * Get colors based on emotional tone
   */
  private getEmotionalColors(tone: string): string[] {
    switch (tone) {
      case "inspirational":
        return ["#FFD700", "#FF6B6B", "#4ECDC4"];
      case "dramatic":
        return ["#FF4757", "#2F3542", "#FFA502"];
      case "peaceful":
        return ["#70A1FF", "#7BED9F", "#DDA0DD"];
      case "energetic":
        return ["#FF6B35", "#F7931E", "#FFD700"];
      case "contemplative":
        return ["#6C5CE7", "#A29BFE", "#FD79A8"];
      default:
        return ["#FFFFFF", "#FFFF00", "#FF6B6B"];
    }
  }

  /**
   * Get animation style based on emotional tone
   */
  private getAnimationForTone(
    tone: string
  ): "fadeIn" | "slideUp" | "typewriter" | "bounce" | "zoom" {
    switch (tone) {
      case "energetic":
        return "bounce";
      case "dramatic":
        return "zoom";
      case "contemplative":
        return "fadeIn";
      case "inspirational":
        return "slideUp";
      default:
        return "slideUp";
    }
  }

  // Utility methods (similar to original service)
  private async getAudioLength(audioPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata.format.duration || 60);
      });
    });
  }

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

  private cleanupSession(sessionDir: string): void {
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn("Failed to cleanup session directory:", error);
    }
  }

  // Public methods for compatibility
  async getVideoGeneration(videoId: string): Promise<VideoGeneration | null> {
    return await this.em.findOne(VideoGeneration, {
      _id: new ObjectId(videoId),
    });
  }

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
