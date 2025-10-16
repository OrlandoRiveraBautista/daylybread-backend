import { createCanvas, CanvasRenderingContext2D } from "canvas";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";

export interface SubtitleStyle {
  style: "dynamic" | "classic" | "neon" | "gradient";
  colorScheme: string[];
  fontSize: number;
  fontFamily: string;
  emojis: boolean;
  animation: "fadeIn" | "slideUp" | "typewriter" | "bounce" | "zoom";
  background: "none" | "shadow" | "box" | "glow";
  position: "bottom" | "center" | "top";
}

export interface SubtitleSegment {
  text: string;
  startTime: number;
  endTime: number;
  emphasis?: boolean; // For highlighting key words
  emoji?: string;
}

export class SubtitleAnimationService {
  private workDir: string;

  constructor(workDir: string) {
    this.workDir = workDir;
  }

  /**
   * Generate animated subtitle files for TikTok-style videos
   */
  async generateAnimatedSubtitles(
    script: string,
    audioLength: number,
    style: SubtitleStyle,
    sessionDir: string
  ): Promise<string> {
    // Parse script into timed segments
    const segments = this.parseScriptIntoSegments(script, audioLength);

    // Add emojis if enabled
    if (style.emojis) {
      this.addEmojiToSegments(segments);
    }

    // Generate subtitle file based on style
    switch (style.style) {
      case "dynamic":
        return this.generateDynamicSubtitles(segments, style, sessionDir);
      case "classic":
        return this.generateClassicSubtitles(segments, style, sessionDir);
      case "neon":
        return this.generateNeonSubtitles(segments, style, sessionDir);
      case "gradient":
        return this.generateGradientSubtitles(segments, style, sessionDir);
      default:
        return this.generateDynamicSubtitles(segments, style, sessionDir);
    }
  }

  /**
   * Parse script into timed segments for subtitles
   */
  private parseScriptIntoSegments(
    script: string,
    audioLength: number
  ): SubtitleSegment[] {
    const sentences = script.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const segments: SubtitleSegment[] = [];

    const wordsPerSecond = 2.5; // Average speaking rate
    const totalWords = script.split(" ").length;
    const actualWPS = totalWords / audioLength;

    let currentTime = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;

      const words = sentence.split(" ");
      const segmentDuration = words.length / actualWPS;

      // Split longer sentences into smaller chunks for better readability
      const maxWordsPerChunk = 6;
      const chunks = this.chunkWords(words, maxWordsPerChunk);

      for (const chunk of chunks) {
        const chunkDuration = chunk.length / actualWPS;
        const endTime = Math.min(currentTime + chunkDuration, audioLength);

        segments.push({
          text: chunk.join(" "),
          startTime: currentTime,
          endTime: endTime,
          emphasis: this.shouldEmphasize(chunk.join(" ")),
        });

        currentTime = endTime;
      }
    }

    return segments;
  }

  /**
   * Add relevant emojis to subtitle segments
   */
  private addEmojiToSegments(segments: SubtitleSegment[]): void {
    const emojiMap: { [key: string]: string } = {
      god: "✨",
      love: "❤️",
      faith: "🙏",
      hope: "🌟",
      peace: "🕊️",
      strength: "💪",
      joy: "😊",
      light: "💡",
      heaven: "☁️",
      prayer: "🙏",
      blessed: "🙌",
      grace: "✨",
      mercy: "💝",
      salvation: "✝️",
      glory: "👑",
      miracle: "✨",
      wisdom: "🧠",
      power: "⚡",
      fire: "🔥",
      victory: "🏆",
    };

    segments.forEach((segment) => {
      const words = segment.text.toLowerCase().split(" ");
      for (const word of words) {
        const cleanWord = word.replace(/[.,!?;:]/g, "");
        if (emojiMap[cleanWord]) {
          segment.emoji = emojiMap[cleanWord];
          break;
        }
      }
    });
  }

  /**
   * Check if text should be emphasized
   */
  private shouldEmphasize(text: string): boolean {
    const emphasisKeywords = [
      "god",
      "jesus",
      "lord",
      "father",
      "spirit",
      "love",
      "faith",
      "hope",
      "grace",
      "mercy",
      "forever",
      "eternal",
      "salvation",
      "blessed",
      "always",
      "never",
      "all",
      "every",
      "everyone",
    ];

    const lowerText = text.toLowerCase();
    return emphasisKeywords.some((keyword) => lowerText.includes(keyword));
  }

  /**
   * Split words into readable chunks
   */
  private chunkWords(words: string[], maxWords: number): string[][] {
    const chunks: string[][] = [];
    for (let i = 0; i < words.length; i += maxWords) {
      chunks.push(words.slice(i, i + maxWords));
    }
    return chunks;
  }

  /**
   * Generate dynamic TikTok-style subtitles
   */
  private async generateDynamicSubtitles(
    segments: SubtitleSegment[],
    style: SubtitleStyle,
    sessionDir: string
  ): Promise<string> {
    const assPath = path.join(sessionDir, "dynamic_subtitles.ass");

    const assHeader = this.generateASSHeader(style);
    let assContent = assHeader;

    segments.forEach((segment, index) => {
      const startTime = this.formatASSTime(segment.startTime);
      const endTime = this.formatASSTime(segment.endTime);

      let text = segment.text;

      // Add emoji if present
      if (segment.emoji) {
        text = `${segment.emoji} ${text}`;
      }

      // Apply emphasis styling
      if (segment.emphasis) {
        text = `{\\b1\\c&H00FFFF&}${text}{\\b0\\c&HFFFFFF&}`;
      }

      // Add animation effects
      const animationTag = this.getAnimationTag(style.animation, index);
      text = `${animationTag}${text}`;

      assContent += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${text}\n`;
    });

    fs.writeFileSync(assPath, assContent);
    return assPath;
  }

  /**
   * Generate classic subtitle style
   */
  private async generateClassicSubtitles(
    segments: SubtitleSegment[],
    style: SubtitleStyle,
    sessionDir: string
  ): Promise<string> {
    const srtPath = path.join(sessionDir, "classic_subtitles.srt");
    let srtContent = "";

    segments.forEach((segment, index) => {
      const startTime = this.formatSRTTime(segment.startTime);
      const endTime = this.formatSRTTime(segment.endTime);

      let text = segment.text;
      if (segment.emoji) {
        text = `${segment.emoji} ${text}`;
      }

      srtContent += `${index + 1}\n${startTime} --> ${endTime}\n${text}\n\n`;
    });

    fs.writeFileSync(srtPath, srtContent);
    return srtPath;
  }

  /**
   * Generate neon-style subtitles
   */
  private async generateNeonSubtitles(
    segments: SubtitleSegment[],
    style: SubtitleStyle,
    sessionDir: string
  ): Promise<string> {
    const assPath = path.join(sessionDir, "neon_subtitles.ass");

    const neonStyle = {
      ...style,
      colorScheme: ["#FF00FF", "#00FFFF", "#FFFF00"], // Neon colors
      animation: "glow" as any,
    };

    const assHeader = this.generateASSHeader(neonStyle, true);
    let assContent = assHeader;

    segments.forEach((segment, index) => {
      const startTime = this.formatASSTime(segment.startTime);
      const endTime = this.formatASSTime(segment.endTime);

      let text = segment.text;
      if (segment.emoji) {
        text = `${segment.emoji} ${text}`;
      }

      // Neon glow effect
      text = `{\\3c&HFF00FF&\\3a&H80&\\be1}${text}`;

      assContent += `Dialogue: 0,${startTime},${endTime},Neon,,0,0,0,,${text}\n`;
    });

    fs.writeFileSync(assPath, assContent);
    return assPath;
  }

  /**
   * Generate gradient-style subtitles
   */
  private async generateGradientSubtitles(
    segments: SubtitleSegment[],
    style: SubtitleStyle,
    sessionDir: string
  ): Promise<string> {
    // Create gradient images for each segment
    const videoOverlayPath = await this.createGradientOverlay(
      segments,
      style,
      sessionDir
    );
    return videoOverlayPath;
  }

  /**
   * Create gradient text overlay video
   */
  private async createGradientOverlay(
    segments: SubtitleSegment[],
    style: SubtitleStyle,
    sessionDir: string
  ): Promise<string> {
    const overlayPath = path.join(sessionDir, "gradient_overlay.mp4");
    const frameRate = 25;
    const totalFrames = Math.ceil(
      segments[segments.length - 1].endTime * frameRate
    );

    // Generate frames for the overlay
    for (let frame = 0; frame < totalFrames; frame++) {
      const currentTime = frame / frameRate;
      const currentSegment = segments.find(
        (s) => currentTime >= s.startTime && currentTime <= s.endTime
      );

      const canvas = createCanvas(1080, 1920);
      const ctx = canvas.getContext("2d");

      // Clear canvas
      ctx.clearRect(0, 0, 1080, 1920);

      if (currentSegment) {
        await this.drawGradientText(ctx, currentSegment, style, currentTime);
      }

      // Save frame
      const frameBuffer = canvas.toBuffer("image/png");
      const framePath = path.join(
        sessionDir,
        "frames",
        `frame_${frame.toString().padStart(6, "0")}.png`
      );

      // Ensure frames directory exists
      const framesDir = path.dirname(framePath);
      if (!fs.existsSync(framesDir)) {
        fs.mkdirSync(framesDir, { recursive: true });
      }

      fs.writeFileSync(framePath, frameBuffer);
    }

    // Convert frames to video
    return new Promise((resolve, reject) => {
      const framesPattern = path.join(sessionDir, "frames", "frame_%06d.png");

      ffmpeg(framesPattern)
        .inputOptions(["-framerate 25"])
        .outputOptions([
          "-c:v libx264",
          "-pix_fmt yuva420p", // Alpha channel for overlay
          "-shortest",
        ])
        .output(overlayPath)
        .on("end", () => resolve(overlayPath))
        .on("error", reject)
        .run();
    });
  }

  /**
   * Draw gradient text on canvas
   */
  private async drawGradientText(
    ctx: CanvasRenderingContext2D,
    segment: SubtitleSegment,
    style: SubtitleStyle,
    currentTime: number
  ): Promise<void> {
    const { text, startTime, endTime } = segment;
    const progress = (currentTime - startTime) / (endTime - startTime);

    // Set font
    ctx.font = `bold ${style.fontSize}px ${style.fontFamily}`;
    ctx.textAlign = "center";

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 1080, 0);
    style.colorScheme.forEach((color, index) => {
      gradient.addColorStop(index / (style.colorScheme.length - 1), color);
    });

    ctx.fillStyle = gradient;

    // Add glow effect
    ctx.shadowColor = style.colorScheme[0];
    ctx.shadowBlur = 20;

    // Position text
    let y = 1920 * 0.8; // Bottom third
    if (style.position === "center") y = 1920 * 0.5;
    if (style.position === "top") y = 1920 * 0.2;

    // Apply animation
    const animatedY = this.applyTextAnimation(y, style.animation, progress);

    // Draw text with outline
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 4;
    ctx.strokeText(text, 540, animatedY);
    ctx.fillText(text, 540, animatedY);
  }

  /**
   * Apply text animation based on style
   */
  private applyTextAnimation(
    baseY: number,
    animation: string,
    progress: number
  ): number {
    switch (animation) {
      case "slideUp":
        return baseY + 50 * (1 - progress);
      case "bounce":
        return baseY - Math.sin(progress * Math.PI) * 20;
      case "zoom":
        // This would require scaling, not just Y position
        return baseY;
      default:
        return baseY;
    }
  }

  /**
   * Generate ASS subtitle header
   */
  private generateASSHeader(
    style: SubtitleStyle,
    neon: boolean = false
  ): string {
    const primaryColor = this.hexToASSColor(style.colorScheme[0] || "#FFFFFF");
    const outlineColor = neon ? this.hexToASSColor("#FF00FF") : "&H000000&";

    return `[Script Info]
Title: Dynamic Bible Video Subtitles
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontFamily},${
      style.fontSize
    },${primaryColor},&Hffffff&,${outlineColor},&H80000000&,1,0,0,0,100,100,0,0,1,3,0,2,10,10,10,1
${
  neon
    ? `Style: Neon,${style.fontFamily},${style.fontSize},&HFF00FF&,&H00FFFF&,&HFFFF00&,&H80000000&,1,0,0,0,100,100,0,0,1,3,2,2,10,10,10,1`
    : ""
}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  }

  /**
   * Get animation tag for ASS subtitles
   */
  private getAnimationTag(animation: string, index: number): string {
    const delay = index * 0.1; // Stagger animations

    switch (animation) {
      case "fadeIn":
        return `{\\fad(300,300)}`;
      case "slideUp":
        return `{\\move(540,1000,540,950,0,300)}`;
      case "typewriter":
        return `{\\t(0,500,\\1a&HFF&\\1a&H00&)}`;
      case "bounce":
        return `{\\t(0,200,\\fscx120\\fscy120)\\t(200,400,\\fscx100\\fscy100)}`;
      case "zoom":
        return `{\\t(0,300,\\fscx150\\fscy150)\\t(300,600,\\fscx100\\fscy100)}`;
      default:
        return `{\\fad(200,200)}`;
    }
  }

  /**
   * Format time for ASS subtitles (H:MM:SS.cc)
   */
  private formatASSTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const centiseconds = Math.floor((seconds % 1) * 100);

    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;
  }

  /**
   * Format time for SRT subtitles (HH:MM:SS,mmm)
   */
  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms
      .toString()
      .padStart(3, "0")}`;
  }

  /**
   * Convert hex color to ASS color format
   */
  private hexToASSColor(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    return `&H${b.toString(16).padStart(2, "0")}${g
      .toString(16)
      .padStart(2, "0")}${r.toString(16).padStart(2, "0")}&`;
  }

  /**
   * Create word-by-word highlighting effect
   */
  async generateWordHighlightSubtitles(
    segments: SubtitleSegment[],
    style: SubtitleStyle,
    sessionDir: string
  ): Promise<string> {
    const assPath = path.join(sessionDir, "word_highlight_subtitles.ass");

    const assHeader = this.generateASSHeader(style);
    let assContent = assHeader;

    segments.forEach((segment, segmentIndex) => {
      const words = segment.text.split(" ");
      const segmentDuration = segment.endTime - segment.startTime;
      const wordDuration = segmentDuration / words.length;

      words.forEach((word, wordIndex) => {
        const wordStart = segment.startTime + wordIndex * wordDuration;
        const wordEnd = wordStart + wordDuration;

        const startTime = this.formatASSTime(wordStart);
        const endTime = this.formatASSTime(wordEnd);

        // Build text with current word highlighted
        const highlightedText = words
          .map((w, i) => {
            if (i === wordIndex) {
              return `{\\c&H00FFFF&\\b1}${w}{\\c&HFFFFFF&\\b0}`;
            } else if (i < wordIndex) {
              return `{\\alpha&H80&}${w}{\\alpha&H00&}`;
            } else {
              return `{\\alpha&HFF&}${w}{\\alpha&H00&}`;
            }
          })
          .join(" ");

        assContent += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${highlightedText}\n`;
      });
    });

    fs.writeFileSync(assPath, assContent);
    return assPath;
  }
}

