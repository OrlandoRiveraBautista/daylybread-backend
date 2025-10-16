import { EntityManager, ObjectId } from "@mikro-orm/mongodb";
import { PubSubEngine } from "graphql-subscriptions";
import { VideoGeneration, VideoStatus } from "../entities/VideoGeneration";
import { VideoGenerationService } from "./VideoGenerationService";
import { OpenAI } from "@langchain/openai";
import * as cron from "node-cron";

export interface ScheduledVideoConfig {
  userId: string;
  verseReference: string;
  theme?: string;
  style?: string;
  backgroundType?: string;
  duration?: number;
  cronSchedule: string; // Cron expression for scheduling
  enabled: boolean;
}

export class VideoScheduler {
  private em: EntityManager;
  private pubSub: PubSubEngine;
  private openai: OpenAI;
  private videoService: VideoGenerationService;
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor(em: EntityManager, pubSub: PubSubEngine, openai: OpenAI) {
    this.em = em;
    this.pubSub = pubSub;
    this.openai = openai;
    this.videoService = new VideoGenerationService(em, openai);
  }

  /**
   * Start the video scheduler
   */
  public start(intervalMs: number = 60000): void {
    if (this.isRunning) {
      console.log("Video scheduler is already running");
      return;
    }

    this.isRunning = true;
    console.log("Starting video scheduler...");

    // Check for scheduled videos every minute
    this.checkInterval = setInterval(async () => {
      await this.processScheduledVideos();
    }, intervalMs);

    // Also run immediately on start
    this.processScheduledVideos();

    // Set up predefined schedules
    this.setupPredefinedSchedules();
  }

  /**
   * Stop the video scheduler
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // Stop all cron jobs
    this.scheduledJobs.forEach((task) => task.stop());
    this.scheduledJobs.clear();

    this.isRunning = false;
    console.log("Video scheduler stopped");
  }

  /**
   * Process scheduled video generations
   */
  private async processScheduledVideos(): Promise<void> {
    try {
      // Find videos scheduled for now or past due
      const now = new Date();
      const scheduledVideos = await this.em.find(VideoGeneration, {
        status: VideoStatus.PENDING,
        scheduledFor: { $lte: now },
      });

      console.log(`Processing ${scheduledVideos.length} scheduled videos`);

      for (const video of scheduledVideos) {
        try {
          // Start video generation process
          this.videoService["processVideoGeneration"](
            video._id.toString()
          ).catch((error) => {
            console.error(
              `Failed to process scheduled video ${video._id}:`,
              error
            );
          });
        } catch (error) {
          console.error(
            `Error starting video generation for ${video._id}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error("Error processing scheduled videos:", error);
    }
  }

  /**
   * Schedule automatic video generation with cron patterns
   */
  public scheduleRecurringVideo(config: ScheduledVideoConfig): string {
    const jobId = `recurring_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    try {
      const task = cron.schedule(
        config.cronSchedule,
        async () => {
          if (!config.enabled) return;

          console.log(
            `Generating scheduled video for user ${config.userId}: ${config.verseReference}`
          );

          try {
            const videoConfig = {
              verseReference: config.verseReference,
              theme: config.theme,
              style: (config.style as any) || "tiktok",
              backgroundType: (config.backgroundType as any) || "stock_footage",
              duration: config.duration || 60,
              autoPost: false, // Don't auto-post scheduled videos by default
            };

            await this.videoService.generateVideo(config.userId, videoConfig);
          } catch (error) {
            console.error(`Failed to generate scheduled video:`, error);
          }
        },
        {
          scheduled: false, // Don't start immediately
        }
      );

      this.scheduledJobs.set(jobId, task);

      if (config.enabled) {
        task.start();
      }

      console.log(
        `Scheduled recurring video job ${jobId} for user ${config.userId}`
      );
      return jobId;
    } catch (error) {
      console.error("Error scheduling recurring video:", error);
      throw error;
    }
  }

  /**
   * Remove a scheduled video job
   */
  public removeScheduledVideo(jobId: string): boolean {
    const task = this.scheduledJobs.get(jobId);
    if (task) {
      task.stop();
      this.scheduledJobs.delete(jobId);
      console.log(`Removed scheduled video job ${jobId}`);
      return true;
    }
    return false;
  }

  /**
   * Enable/disable a scheduled video job
   */
  public toggleScheduledVideo(jobId: string, enabled: boolean): boolean {
    const task = this.scheduledJobs.get(jobId);
    if (task) {
      if (enabled) {
        task.start();
      } else {
        task.stop();
      }
      console.log(
        `${enabled ? "Enabled" : "Disabled"} scheduled video job ${jobId}`
      );
      return true;
    }
    return false;
  }

  /**
   * Set up predefined video generation schedules
   */
  private setupPredefinedSchedules(): void {
    // Daily inspirational verse videos (every day at 6 AM)
    const dailyVerses = [
      "Jeremiah 29:11",
      "Philippians 4:13",
      "Romans 8:28",
      "Proverbs 3:5-6",
      "Isaiah 40:31",
      "Matthew 28:20",
      "Psalm 46:10",
      "John 3:16",
      "2 Corinthians 5:17",
      "Ephesians 2:8-9",
    ];

    // Weekly themed video series (every Sunday at 8 AM)
    const weeklyThemes = [
      {
        theme: "Faith Over Fear",
        verses: ["Joshua 1:9", "Isaiah 41:10", "Deuteronomy 31:6"],
      },
      {
        theme: "God's Love",
        verses: ["1 John 4:8", "Romans 5:8", "John 3:16"],
      },
      {
        theme: "Hope in Trials",
        verses: ["Romans 8:28", "James 1:2-3", "2 Corinthians 4:17"],
      },
      {
        theme: "Prayer Power",
        verses: ["Philippians 4:6-7", "Matthew 7:7", "1 Thessalonians 5:17"],
      },
    ];

    // Example: Daily verse at 6 AM (would need user configuration in real implementation)
    /*
    cron.schedule('0 6 * * *', async () => {
      console.log('Generating daily inspirational video');
      
      const randomVerse = dailyVerses[Math.floor(Math.random() * dailyVerses.length)];
      
      // This would need to be configured per user in a real implementation
      // For now, it's just an example of how scheduling would work
      
      try {
        const config = {
          verseReference: randomVerse,
          theme: "Daily Inspiration",
          style: 'tiktok' as any,
          backgroundType: 'stock_footage' as any,
          duration: 45,
          autoPost: true,
        };

        // Generate for active users (would need user preference system)
        // await this.videoService.generateVideo(userId, config);
      } catch (error) {
        console.error('Failed to generate daily video:', error);
      }
    });
    */

    console.log("Predefined video schedules configured");
  }

  /**
   * Generate video for specific Bible stories with automated scheduling
   */
  public async scheduleStorySeriesVideos(
    userId: string,
    storyTitle: string,
    storyParts: string[],
    scheduleType: "daily" | "weekly" | "custom",
    customCron?: string
  ): Promise<string[]> {
    const jobIds: string[] = [];

    let cronPattern: string;
    switch (scheduleType) {
      case "daily":
        cronPattern = "0 18 * * *"; // Daily at 6 PM
        break;
      case "weekly":
        cronPattern = "0 10 * * 0"; // Weekly on Sunday at 10 AM
        break;
      case "custom":
        cronPattern = customCron || "0 12 * * *"; // Default to noon daily
        break;
    }

    for (let i = 0; i < storyParts.length; i++) {
      const partNumber = i + 1;
      const config: ScheduledVideoConfig = {
        userId,
        verseReference: storyParts[i],
        theme: `${storyTitle} - Part ${partNumber}`,
        style: "tiktok",
        backgroundType: "stock_footage",
        duration: 60,
        cronSchedule: cronPattern,
        enabled: true,
      };

      // Schedule each part with appropriate delay
      const delayedCron = this.adjustCronForDelay(cronPattern, i);
      config.cronSchedule = delayedCron;

      const jobId = this.scheduleRecurringVideo(config);
      jobIds.push(jobId);
    }

    return jobIds;
  }

  /**
   * Adjust cron pattern to add delay between parts
   */
  private adjustCronForDelay(cronPattern: string, delayDays: number): string {
    // This is a simplified implementation
    // In production, you'd want more sophisticated scheduling logic
    return cronPattern;
  }

  /**
   * Get popular Bible stories for automated series
   */
  public getPopularBibleStories(): { [key: string]: string[] } {
    return {
      "David and Goliath": [
        "1 Samuel 17:1-11", // The Challenge
        "1 Samuel 17:12-30", // David Arrives
        "1 Samuel 17:31-40", // David Prepares
        "1 Samuel 17:41-54", // The Victory
      ],
      "Moses and the Exodus": [
        "Exodus 1:8-14", // Oppression in Egypt
        "Exodus 2:1-10", // Baby Moses
        "Exodus 3:1-15", // The Burning Bush
        "Exodus 7:14-25", // The Plagues Begin
        "Exodus 14:10-31", // Crossing the Red Sea
      ],
      "Daniel in the Lion's Den": [
        "Daniel 6:1-9", // The Trap
        "Daniel 6:10-17", // Daniel's Faith
        "Daniel 6:18-28", // God's Deliverance
      ],
      "The Prodigal Son": [
        "Luke 15:11-16", // The Son Leaves
        "Luke 15:17-20", // The Return
        "Luke 15:21-32", // The Father's Love
      ],
      "Jesus' Birth": [
        "Luke 1:26-38", // The Announcement
        "Luke 2:1-7", // The Birth
        "Luke 2:8-20", // The Shepherds
        "Matthew 2:1-12", // The Wise Men
      ],
    };
  }

  /**
   * Cleanup old video generations to save storage
   */
  public async cleanupOldVideos(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const oldVideos = await this.em.find(VideoGeneration, {
        status: { $in: [VideoStatus.COMPLETED, VideoStatus.FAILED] },
        createdAt: { $lt: cutoffDate },
      });

      let deletedCount = 0;
      for (const video of oldVideos) {
        try {
          // TODO: Also delete associated S3 files
          // await this.deleteS3Files(video);

          await this.em.removeAndFlush(video);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete video ${video._id}:`, error);
        }
      }

      console.log(`Cleaned up ${deletedCount} old video generations`);
      return deletedCount;
    } catch (error) {
      console.error("Error cleaning up old videos:", error);
      return 0;
    }
  }

  /**
   * Get scheduler statistics
   */
  public getSchedulerStats(): {
    isRunning: boolean;
    activeJobs: number;
    totalScheduledJobs: number;
  } {
    return {
      isRunning: this.isRunning,
      activeJobs: Array.from(this.scheduledJobs.values()).filter(
        (task) => task.getStatus() === "scheduled"
      ).length,
      totalScheduledJobs: this.scheduledJobs.size,
    };
  }

  /**
   * Schedule trending topics videos based on current events or seasons
   */
  public async scheduleTrendingTopicsVideos(): Promise<string[]> {
    const currentMonth = new Date().getMonth();
    const jobIds: string[] = [];

    // Seasonal/holiday content
    const seasonalTopics: {
      [key: number]: { theme: string; verses: string[] };
    } = {
      11: {
        // December
        theme: "Christmas Hope",
        verses: ["Luke 2:10-11", "Isaiah 9:6", "Matthew 1:23"],
      },
      3: {
        // April (Easter season)
        theme: "Resurrection Power",
        verses: ["Matthew 28:5-6", "1 Corinthians 15:55", "Romans 6:9"],
      },
      0: {
        // January (New Year)
        theme: "New Beginnings",
        verses: ["2 Corinthians 5:17", "Lamentations 3:22-23", "Isaiah 43:19"],
      },
    };

    const seasonal = seasonalTopics[currentMonth];
    if (seasonal) {
      for (const verse of seasonal.verses) {
        // Schedule for prime social media times
        const config: ScheduledVideoConfig = {
          userId: "system", // System-generated content
          verseReference: verse,
          theme: seasonal.theme,
          style: "tiktok",
          backgroundType: "stock_footage",
          duration: 45,
          cronSchedule: "0 19 * * *", // Daily at 7 PM
          enabled: true,
        };

        const jobId = this.scheduleRecurringVideo(config);
        jobIds.push(jobId);
      }
    }

    return jobIds;
  }
}

