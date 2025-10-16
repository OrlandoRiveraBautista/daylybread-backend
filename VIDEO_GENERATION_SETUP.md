# 🎬 AI Bible Video Generation System

A comprehensive system for generating engaging social media videos from Bible verses with AI-powered narration, dynamic subtitles, and automated scheduling.

## 🚀 Features

### Core Features

- **AI Script Generation**: Uses OpenAI GPT to create engaging 30-60 second scripts from Bible verses
- **Text-to-Speech**: High-quality AI narration using OpenAI TTS
- **Dynamic Backgrounds**: Stock footage from Pexels API or AI-generated backgrounds
- **Animated Subtitles**: TikTok-style dynamic subtitles with emojis and animations
- **Multiple Video Styles**: TikTok, Instagram Reels, YouTube Shorts optimized formats
- **Automated Scheduling**: Cron-based video generation with recurring schedules
- **Cloud Storage**: AWS S3 integration for video storage and delivery

### Subtitle Animations

- **Dynamic Style**: TikTok-style with color changes and animations
- **Classic Style**: Traditional subtitle format
- **Neon Style**: Glowing text effects
- **Gradient Style**: Color gradient text overlays
- **Word Highlighting**: Progressive word-by-word highlighting
- **Emoji Integration**: Contextual emoji insertion

### Background Options

- **Stock Footage**: Automated Pexels API integration with biblical keyword mapping
- **Static with Motion**: Generated gradient backgrounds with zoom/pan effects
- **AI Generated**: Support for AI video generation (Pika Labs/Runway integration ready)

## 📋 Prerequisites

### Required Dependencies

```bash
npm install fluent-ffmpeg @types/fluent-ffmpeg node-cron @types/node-cron canvas sharp jimp music-metadata uuid @types/uuid
```

### System Requirements

- **FFmpeg**: Must be installed on the system
- **MongoDB**: For data persistence
- **AWS S3**: For video storage
- **OpenAI API**: For script generation and TTS
- **Pexels API**: For stock footage (optional)

### Installation Commands

#### macOS (Homebrew)

```bash
brew install ffmpeg
```

#### Ubuntu/Debian

```bash
sudo apt update
sudo apt install ffmpeg
```

#### Windows

Download FFmpeg from https://ffmpeg.org/download.html and add to PATH

## 🔧 Configuration

### Environment Variables

Add these to your `.env` file:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-video-bucket-name

# Pexels API (Optional)
PEXELS_API_KEY=your_pexels_api_key_here

# MongoDB
MONGODBCLIENTURL=your_mongodb_connection_string
```

### AWS S3 Setup

1. Create an S3 bucket for video storage
2. Set up proper IAM permissions for read/write access
3. Configure CORS if serving videos directly from S3

### Pexels API Setup (Optional)

1. Sign up at https://www.pexels.com/api/
2. Get your free API key
3. Add to environment variables

## 📡 GraphQL API

### Mutations

#### Create Video Generation

```graphql
mutation CreateVideoGeneration($input: VideoGenerationWithSubtitlesInput!) {
  createVideoGeneration(input: $input) {
    errors {
      field
      message
    }
    videoGeneration {
      _id
      verseReference
      status
      progress
      finalVideoUrl
    }
  }
}
```

#### Example Input

```json
{
  "input": {
    "verseReference": "John 3:16",
    "theme": "God's Love",
    "style": "TIKTOK",
    "backgroundType": "STOCK_FOOTAGE",
    "duration": 45,
    "subtitleConfig": {
      "style": "dynamic",
      "colorScheme": ["#FFFFFF", "#FFFF00", "#FF6B6B"],
      "fontSize": 48,
      "emojis": true
    },
    "musicGenre": "worship",
    "autoPost": false
  }
}
```

### Queries

#### Get Video Generation Status

```graphql
query GetVideoGeneration($videoId: String!) {
  getVideoGeneration(videoId: $videoId) {
    videoGeneration {
      _id
      status
      progress
      errorMessage
      finalVideoUrl
      createdAt
      completedAt
    }
  }
}
```

#### Get User's Video Generations

```graphql
query GetUserVideoGenerations($limit: Int, $offset: Int) {
  getUserVideoGenerations(limit: $limit, offset: $offset) {
    videoGenerations {
      _id
      verseReference
      status
      finalVideoUrl
      createdAt
    }
    total
  }
}
```

### Subscriptions

#### Real-time Progress Updates

```graphql
subscription VideoGenerationUpdate($videoId: String!) {
  videoGenerationUpdated(videoId: $videoId) {
    _id
    status
    progress
    errorMessage
  }
}
```

## 🤖 Automated Scheduling

### Basic Scheduling

```typescript
import { VideoScheduler } from "./services/VideoScheduler";

const scheduler = new VideoScheduler(em, pubSub, openai);
scheduler.start();

// Schedule daily videos at 6 PM
const jobId = scheduler.scheduleRecurringVideo({
  userId: "user123",
  verseReference: "Psalm 23:1",
  theme: "Daily Inspiration",
  style: "tiktok",
  cronSchedule: "0 18 * * *", // 6 PM daily
  enabled: true,
});
```

### Story Series Scheduling

```typescript
// Schedule a complete Bible story series
const storyParts = [
  "1 Samuel 17:1-11", // David & Goliath - The Challenge
  "1 Samuel 17:12-30", // David Arrives
  "1 Samuel 17:31-40", // David Prepares
  "1 Samuel 17:41-54", // The Victory
];

const jobIds = await scheduler.scheduleStorySeriesVideos(
  "user123",
  "David and Goliath",
  storyParts,
  "weekly" // or "daily", "custom"
);
```

### Cron Schedule Examples

```javascript
"0 18 * * *"; // Daily at 6 PM
"0 10 * * 0"; // Weekly on Sunday at 10 AM
"0 12 1 * *"; // Monthly on 1st at noon
"0 20 * * 1-5"; // Weekdays at 8 PM
"0 9,18 * * *"; // Twice daily at 9 AM and 6 PM
```

## 🎨 Customization Options

### Video Styles

- **TIKTOK**: 1080x1920, optimized for mobile consumption
- **INSTAGRAM_REEL**: Similar to TikTok with Instagram-specific optimizations
- **YOUTUBE_SHORT**: Optimized for YouTube Shorts algorithm

### Subtitle Styles

- **Dynamic**: Animated, colorful, emoji-enhanced
- **Classic**: Traditional subtitle appearance
- **Neon**: Glowing text with neon effects
- **Gradient**: Color gradient text overlays

### Background Types

- **STOCK_FOOTAGE**: Real video footage from Pexels
- **STATIC_WITH_MOTION**: Animated static backgrounds
- **AI_GENERATED**: AI-generated video backgrounds (future)

### Animation Options

- **fadeIn**: Gentle fade-in effect
- **slideUp**: Text slides up into view
- **typewriter**: Characters appear one by one
- **bounce**: Bouncing text animation
- **zoom**: Zoom in/out effects

## 🔄 Integration with Existing App

### Server Integration

The VideoGenerationResolver is automatically registered in `server.ts`:

```typescript
import { VideoGenerationResolver } from "./resolvers/VideoGenerationResolver";

// Added to resolvers array
resolvers: [
  // ... existing resolvers
  VideoGenerationResolver,
];
```

### Database Entity

The VideoGeneration entity is registered in `mikro-orm.config.ts`:

```typescript
import { VideoGeneration } from "./entities/VideoGeneration";

entities: [
  // ... existing entities
  VideoGeneration,
];
```

## 📊 Monitoring & Analytics

### Progress Tracking

Each video generation tracks:

- Status (pending, generating, completed, failed)
- Progress percentage (0-100)
- Processing time and costs
- Error messages for debugging

### Statistics

```graphql
query GetVideoStats {
  getVideoGenerationStats
}
```

Returns JSON with:

- Total videos generated
- Videos completed today
- Status breakdown
- Success/failure rates

## 🚀 Usage Examples

### Frontend Integration (React/React Native)

```typescript
import { useSubscription, useMutation } from "@apollo/client";

const [createVideo] = useMutation(CREATE_VIDEO_GENERATION);
const { data: progress } = useSubscription(VIDEO_GENERATION_UPDATE, {
  variables: { videoId },
});

// Create a video
const handleCreateVideo = async () => {
  const result = await createVideo({
    variables: {
      input: {
        verseReference: "Philippians 4:13",
        style: "TIKTOK",
        duration: 60,
        subtitleConfig: {
          style: "dynamic",
          emojis: true,
          colorScheme: ["#FFFFFF", "#FFD700"],
        },
      },
    },
  });

  setVideoId(result.data.createVideoGeneration.videoGeneration._id);
};
```

### Batch Video Generation

```typescript
const verses = [
  "John 3:16",
  "Romans 8:28",
  "Philippians 4:13",
  "Jeremiah 29:11",
];

for (const verse of verses) {
  await videoService.generateVideo(userId, {
    verseReference: verse,
    style: "tiktok",
    backgroundType: "stock_footage",
    duration: 45,
  });
}
```

## 🛠️ Troubleshooting

### Common Issues

#### FFmpeg Not Found

```bash
# Verify FFmpeg installation
ffmpeg -version

# If not installed, install using package manager
# macOS: brew install ffmpeg
# Ubuntu: sudo apt install ffmpeg
```

#### Audio Generation Fails

- Check OpenAI API key and credits
- Verify TTS model availability
- Check script length (should be under 4096 characters)

#### Subtitle Rendering Issues

- Ensure canvas package is properly installed
- Check font availability on system
- Verify ASS/SRT file formatting

#### S3 Upload Failures

- Verify AWS credentials and permissions
- Check bucket existence and region
- Ensure sufficient storage space

### Performance Optimization

#### Video Processing

- Use appropriate video codecs (H.264 for compatibility)
- Optimize resolution for target platform
- Consider using hardware acceleration if available

#### Memory Management

- Clean up temporary files after processing
- Limit concurrent video generations
- Monitor RAM usage during canvas operations

## 🔮 Future Enhancements

### Planned Features

- **AI Video Backgrounds**: Integration with Pika Labs/Runway
- **Voice Cloning**: Custom voice training for branded content
- **Advanced Analytics**: Detailed performance metrics
- **Multi-language Support**: Generate videos in multiple languages
- **Social Media Auto-posting**: Direct posting to TikTok/Instagram/YouTube
- **Interactive Elements**: Polls, questions, call-to-actions
- **Background Music**: Automated music selection and mixing
- **Collaborative Features**: Team video creation and approval workflows

### API Roadmap

- **Webhook Support**: Real-time notifications for completed videos
- **Template System**: Reusable video templates
- **Bulk Operations**: Batch processing capabilities
- **Advanced Scheduling**: Complex scheduling rules and conditions
- **Content Moderation**: Automated content review and approval

## 📝 License & Usage

This video generation system is part of the DaylyBread platform. Ensure compliance with:

- OpenAI Terms of Service
- Pexels License Requirements
- AWS Service Terms
- Platform-specific content guidelines (TikTok, Instagram, YouTube)

## 🆘 Support

For technical support or feature requests:

1. Check the troubleshooting section
2. Review the API documentation
3. Contact the development team
4. Submit issues through the appropriate channels

---

**Happy Video Creating! 🎬✨**

