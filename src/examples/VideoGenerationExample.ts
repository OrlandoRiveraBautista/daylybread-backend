/**
 * Example implementation of the Bible Video Generation System
 *
 * This file demonstrates how to use the video generation features
 * in various scenarios and provides working examples.
 */

import { EntityManager } from "@mikro-orm/mongodb";
import { PubSubEngine } from "graphql-subscriptions";
import { OpenAI } from "@langchain/openai";
import {
  VideoGenerationService,
  VideoGenerationConfig,
} from "../services/VideoGenerationService";
import { VideoScheduler } from "../services/VideoScheduler";
import { VideoStyle, BackgroundType } from "../entities/VideoGeneration";

export class VideoGenerationExample {
  private videoService: VideoGenerationService;
  private scheduler: VideoScheduler;

  constructor(em: EntityManager, pubSub: PubSubEngine, openai: OpenAI) {
    this.videoService = new VideoGenerationService(em, openai);
    this.scheduler = new VideoScheduler(em, pubSub, openai);
  }

  /**
   * Example 1: Generate a single TikTok-style video
   */
  async generateTikTokVideo(userId: string): Promise<void> {
    console.log("🎬 Generating TikTok-style video...");

    const config: VideoGenerationConfig = {
      verseReference: "John 3:16",
      theme: "God's Amazing Love",
      style: VideoStyle.TIKTOK,
      backgroundType: BackgroundType.STOCK_FOOTAGE,
      duration: 60,
      subtitleConfig: {
        style: "dynamic",
        colorScheme: ["#FFFFFF", "#FFD700", "#FF6B6B"],
        fontSize: 48,
        fontFamily: "Arial Black",
        emojis: true,
      },
      musicGenre: "worship",
      autoPost: false,
    };

    try {
      const video = await this.videoService.generateVideo(userId, config);
      console.log(`✅ Video generation started! ID: ${video._id}`);
      console.log(`📊 Track progress with: getVideoGeneration("${video._id}")`);
    } catch (error) {
      console.error("❌ Failed to generate video:", error);
    }
  }

  /**
   * Example 2: Generate Instagram Reel with custom styling
   */
  async generateInstagramReel(userId: string): Promise<void> {
    console.log("📱 Generating Instagram Reel...");

    const config: VideoGenerationConfig = {
      verseReference: "Philippians 4:13",
      theme: "Strength Through Faith",
      customPrompt: "Make it energetic and motivational for young adults",
      style: VideoStyle.INSTAGRAM_REEL,
      backgroundType: BackgroundType.STATIC_WITH_MOTION,
      duration: 45,
      subtitleConfig: {
        style: "neon",
        colorScheme: ["#FF00FF", "#00FFFF", "#FFFF00"],
        fontSize: 52,
        fontFamily: "Impact",
        emojis: true,
      },
      autoPost: false,
    };

    try {
      const video = await this.videoService.generateVideo(userId, config);
      console.log(`✅ Instagram Reel generation started! ID: ${video._id}`);
    } catch (error) {
      console.error("❌ Failed to generate Instagram Reel:", error);
    }
  }

  /**
   * Example 3: Batch generate videos for a Bible study series
   */
  async generateBibleStudySeries(userId: string): Promise<void> {
    console.log("📚 Generating Bible Study Series...");

    const seriesVerses = [
      { verse: "Genesis 1:1", theme: "In the Beginning" },
      { verse: "Genesis 1:27", theme: "Made in God's Image" },
      { verse: "Genesis 3:15", theme: "Promise of Hope" },
      { verse: "Genesis 12:1-3", theme: "God's Covenant" },
    ];

    const baseConfig: Omit<VideoGenerationConfig, "verseReference" | "theme"> =
      {
        style: VideoStyle.YOUTUBE_SHORT,
        backgroundType: BackgroundType.STOCK_FOOTAGE,
        duration: 75,
        subtitleConfig: {
          style: "classic",
          colorScheme: ["#FFFFFF", "#E6E6FA"],
          fontSize: 44,
          fontFamily: "Georgia",
          emojis: false,
        },
        musicGenre: "cinematic",
        autoPost: false,
      };

    for (const { verse, theme } of seriesVerses) {
      try {
        const config: VideoGenerationConfig = {
          ...baseConfig,
          verseReference: verse,
          theme,
        };

        const video = await this.videoService.generateVideo(userId, config);
        console.log(`✅ Generated video for ${verse}: ${video._id}`);

        // Wait 5 seconds between generations to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (error) {
        console.error(`❌ Failed to generate video for ${verse}:`, error);
      }
    }
  }

  /**
   * Example 4: Set up automated daily inspiration videos
   */
  async setupDailyInspiration(userId: string): Promise<void> {
    console.log("⏰ Setting up daily inspiration videos...");

    const inspirationalVerses = [
      "Jeremiah 29:11",
      "Romans 8:28",
      "Philippians 4:13",
      "Isaiah 40:31",
      "Proverbs 3:5-6",
      "Matthew 28:20",
      "Psalm 46:10",
      "2 Corinthians 5:17",
    ];

    this.scheduler.start();

    // Schedule daily videos at 6 AM
    for (let i = 0; i < inspirationalVerses.length; i++) {
      const verse = inspirationalVerses[i];

      const jobId = this.scheduler.scheduleRecurringVideo({
        userId,
        verseReference: verse,
        theme: "Daily Inspiration",
        style: "tiktok",
        backgroundType: "stock_footage",
        duration: 45,
        cronSchedule: "0 6 * * *", // 6 AM daily
        enabled: true,
      });

      console.log(`✅ Scheduled daily video for ${verse}: Job ID ${jobId}`);
    }
  }

  /**
   * Example 5: Create themed video series with scheduling
   */
  async createThemedSeries(userId: string): Promise<void> {
    console.log("🎭 Creating themed video series...");

    // David and Goliath series
    const davidGoliathStory = [
      "1 Samuel 17:1-11", // The Challenge
      "1 Samuel 17:12-30", // David Arrives
      "1 Samuel 17:31-40", // David Prepares
      "1 Samuel 17:41-54", // The Victory
    ];

    this.scheduler.start();

    try {
      const jobIds = await this.scheduler.scheduleStorySeriesVideos(
        userId,
        "David and Goliath",
        davidGoliathStory,
        "weekly" // Release one part per week
      );

      console.log(
        `✅ Scheduled David & Goliath series: ${jobIds.length} videos`
      );
      console.log("📅 Videos will be released weekly on Sundays at 10 AM");
    } catch (error) {
      console.error("❌ Failed to schedule story series:", error);
    }
  }

  /**
   * Example 6: Monitor video generation progress
   */
  async monitorProgress(videoId: string): Promise<void> {
    console.log(`👀 Monitoring progress for video ${videoId}...`);

    const checkProgress = async () => {
      try {
        const video = await this.videoService.getVideoGeneration(videoId);

        if (!video) {
          console.log("❌ Video not found");
          return;
        }

        console.log(`📊 Status: ${video.status}`);
        console.log(`⚡ Progress: ${video.progress}%`);

        if (video.errorMessage) {
          console.log(`❌ Error: ${video.errorMessage}`);
        }

        if (video.finalVideoUrl) {
          console.log(`🎉 Video completed! URL: ${video.finalVideoUrl}`);
          return;
        }

        // Check again in 10 seconds if not completed
        if (video.status !== "completed" && video.status !== "failed") {
          setTimeout(checkProgress, 10000);
        }
      } catch (error) {
        console.error("❌ Failed to check progress:", error);
      }
    };

    checkProgress();
  }

  /**
   * Example 7: Generate videos with different subtitle styles
   */
  async generateStyleVariations(userId: string): Promise<void> {
    console.log("🎨 Generating videos with different styles...");

    const baseVerse = "Psalm 23:1";
    const styles = [
      {
        name: "Dynamic TikTok Style",
        config: {
          style: "dynamic" as const,
          colorScheme: ["#FFFFFF", "#FFD700", "#FF6B6B"],
          fontSize: 48,
          fontFamily: "Arial Black",
          emojis: true,
        },
      },
      {
        name: "Classic Elegant Style",
        config: {
          style: "classic" as const,
          colorScheme: ["#FFFFFF", "#E6E6FA"],
          fontSize: 42,
          fontFamily: "Times New Roman",
          emojis: false,
        },
      },
      {
        name: "Neon Gaming Style",
        config: {
          style: "neon" as const,
          colorScheme: ["#FF00FF", "#00FFFF", "#FFFF00"],
          fontSize: 50,
          fontFamily: "Impact",
          emojis: true,
        },
      },
    ];

    for (const style of styles) {
      try {
        const config: VideoGenerationConfig = {
          verseReference: baseVerse,
          theme: style.name,
          style: VideoStyle.TIKTOK,
          backgroundType: BackgroundType.STOCK_FOOTAGE,
          duration: 45,
          subtitleConfig: style.config,
        };

        const video = await this.videoService.generateVideo(userId, config);
        console.log(`✅ Generated ${style.name}: ${video._id}`);

        // Wait between generations
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (error) {
        console.error(`❌ Failed to generate ${style.name}:`, error);
      }
    }
  }

  /**
   * Example 8: Handle video generation errors and retries
   */
  async generateWithRetry(
    userId: string,
    maxRetries: number = 3
  ): Promise<void> {
    console.log("🔄 Generating video with retry logic...");

    const config: VideoGenerationConfig = {
      verseReference: "Romans 8:28",
      theme: "All Things Work Together",
      style: VideoStyle.TIKTOK,
      backgroundType: BackgroundType.STOCK_FOOTAGE,
      duration: 60,
    };

    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        attempts++;
        console.log(`🎬 Attempt ${attempts}/${maxRetries}`);

        const video = await this.videoService.generateVideo(userId, config);
        console.log(`✅ Video generation successful on attempt ${attempts}!`);
        console.log(`🆔 Video ID: ${video._id}`);
        return;
      } catch (error) {
        console.error(`❌ Attempt ${attempts} failed:`, error);

        if (attempts < maxRetries) {
          console.log(`⏳ Waiting 30 seconds before retry...`);
          await new Promise((resolve) => setTimeout(resolve, 30000));
        } else {
          console.error("💥 All retry attempts exhausted");
          throw error;
        }
      }
    }
  }

  /**
   * Example 9: Cleanup and maintenance
   */
  async performMaintenance(): Promise<void> {
    console.log("🧹 Performing system maintenance...");

    try {
      // Clean up old videos (older than 30 days)
      const deletedCount = await this.scheduler.cleanupOldVideos(30);
      console.log(`🗑️ Cleaned up ${deletedCount} old video records`);

      // Get scheduler statistics
      const stats = this.scheduler.getSchedulerStats();
      console.log("📊 Scheduler Statistics:");
      console.log(`   - Running: ${stats.isRunning}`);
      console.log(`   - Active Jobs: ${stats.activeJobs}`);
      console.log(`   - Total Scheduled: ${stats.totalScheduledJobs}`);
    } catch (error) {
      console.error("❌ Maintenance failed:", error);
    }
  }

  /**
   * Example 10: Advanced configuration showcase
   */
  async showcaseAdvancedFeatures(userId: string): Promise<void> {
    console.log("🚀 Showcasing advanced features...");

    const advancedConfig: VideoGenerationConfig = {
      verseReference: "Ephesians 6:10-17",
      theme: "Armor of God",
      customPrompt:
        "Create an epic, cinematic retelling focusing on spiritual warfare. Use metaphors of a warrior preparing for battle. Make it dramatic and powerful.",
      style: VideoStyle.YOUTUBE_SHORT,
      backgroundType: BackgroundType.STOCK_FOOTAGE,
      duration: 90, // Maximum length
      subtitleConfig: {
        style: "gradient",
        colorScheme: ["#FFD700", "#FF6B35", "#8B0000"], // Gold to red gradient
        fontSize: 54,
        fontFamily: "Cinzel", // Epic font (fallback to serif)
        emojis: true,
      },
      musicGenre: "cinematic",
      autoPost: false,
      postingPlatforms: ["youtube", "instagram", "tiktok"],
    };

    try {
      const video = await this.videoService.generateVideo(
        userId,
        advancedConfig
      );
      console.log("🎬 Advanced video generation started!");
      console.log(`🆔 Video ID: ${video._id}`);
      console.log("🎯 Features used:");
      console.log("   ✨ Custom script prompt");
      console.log("   🎨 Gradient subtitle style");
      console.log("   🎵 Cinematic background music");
      console.log("   📱 Multi-platform optimization");
      console.log("   ⏱️ Extended 90-second duration");
    } catch (error) {
      console.error("❌ Advanced video generation failed:", error);
    }
  }
}

// Usage Examples:
//
// const em = // Your EntityManager instance
// const pubSub = // Your PubSub instance
// const openai = // Your OpenAI instance
// const userId = "user123";
//
// const examples = new VideoGenerationExample(em, pubSub, openai);
//
// // Generate single videos
// await examples.generateTikTokVideo(userId);
// await examples.generateInstagramReel(userId);
//
// // Batch operations
// await examples.generateBibleStudySeries(userId);
//
// // Automated scheduling
// await examples.setupDailyInspiration(userId);
// await examples.createThemedSeries(userId);
//
// // Style variations
// await examples.generateStyleVariations(userId);
//
// // Advanced features
// await examples.showcaseAdvancedFeatures(userId);
//
// // System maintenance
// await examples.performMaintenance();

