# ViewNami Backend API

High-performance Node.js backend for ViewNami with OpenAI Whisper (voice transcription), GPT-4 mini (text rewriting), Redis caching, and Server-Sent Events streaming.

## 🚀 Features

- **Whisper API Integration** - Fast, accurate voice-to-text transcription
- **GPT-4 Mini Streaming** - Real-time text rewriting with 30 optimized presets
- **Redis Caching** - 10x speed improvement on repeated queries
- **Few-Shot Learning** - Each preset includes examples for better AI outputs
- **Server-Sent Events** - Progressive streaming for instant user feedback
- **Production Ready** - Security, compression, rate limiting, health checks
- **Railway Optimized** - Easy one-click deployment

## 📋 Prerequisites

- Node.js 18+ 
- Redis server (or Railway Redis add-on)
- OpenAI API key

## 🛠️ Installation

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Copy `env.example` to `.env`:

```bash
cp env.example .env
```

Edit `.env` with your values:

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
REDIS_URL=redis://localhost:6379
PORT=3000
NODE_ENV=production
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
TRANSCRIPTION_CACHE_TTL=86400
REWRITE_CACHE_TTL=604800
```

### 3. Run Locally

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

Server will start on `http://localhost:3000`

## 🌐 API Endpoints

### Health Check
```http
GET /health
```

Returns server health status and service availability.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-27T...",
  "environment": "production",
  "services": {
    "redis": { "status": "healthy" },
    "openai": { "status": "healthy", "configured": true }
  }
}
```

### Transcribe Audio
```http
POST /api/transcribe
Content-Type: multipart/form-data
```

**Request:**
- Field: `audio` (file)
- Formats: WAV, MP3, M4A, WebM, OGG, FLAC
- Max size: 25MB

**Response:**
```json
{
  "text": "Transcribed text here",
  "cached": false,
  "duration_ms": 1234
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/transcribe \
  -F "audio=@recording.wav"
```

### Rewrite Text (Streaming)
```http
POST /api/rewrite
Content-Type: application/json
```

**Request:**
```json
{
  "text": "Your input text here",
  "presetId": "formal-email"
}
```

**Response:** Server-Sent Events (SSE) stream

**SSE Events:**
```
data: {"chunk":"Rewritten "}
data: {"chunk":"text "}
data: {"chunk":"here"}
data: {"type":"done","text":"Rewritten text here","cached":false,"duration_ms":2345}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/rewrite \
  -H "Content-Type: application/json" \
  -d '{"text":"hey how are you","presetId":"formal-email"}' \
  --no-buffer
```

### Rewrite Text (Non-Streaming)
```http
POST /api/rewrite/batch
Content-Type: application/json
```

**Request:**
```json
{
  "text": "Your input text here",
  "presetId": "casual"
}
```

**Response:**
```json
{
  "text": "Rewritten text here",
  "cached": false,
  "duration_ms": 1500
}
```

## 🎯 Available Presets

### General (3)
- `magic` - AI chooses best style
- `slightly` - Clean up text
- `significantly` - Major revision

### Text Editing (3)
- `structured` - Organize with bullets/headings
- `shorter` - Reduce length
- `list` - Convert to list format

### Content Creation (9)
- `x-post` - Twitter/X post (<280 chars)
- `x-thread` - Twitter/X thread
- `facebook` - Facebook post
- `linkedin` - LinkedIn post
- `instagram` - Instagram caption
- `video-script` - YouTube script
- `short-video` - TikTok/Reels script
- `newsletter` - Email newsletter
- `outline` - Structured outline

### Journaling (2)
- `journal` - Journal entry
- `gratitude` - Gratitude journal

### Emails (2)
- `casual-email` - Informal email
- `formal-email` - Professional email

### Summary (3)
- `short-summary` - Brief summary
- `detailed-summary` - Comprehensive summary
- `meeting-takeaways` - Meeting notes

### Writing Styles (5)
- `business` - Business communication
- `formal` - Highly formal
- `casual` - Informal & relaxed
- `friendly` - Like writing to a friend
- `clear-concise` - Maximum clarity

### Holiday Greetings (3)
- `funny` - Funny & lighthearted
- `warm` - Warm & friendly
- `simple-professional` - Simple professional

## 🚂 Railway Deployment

### Quick Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

### Manual Deployment Steps

1. **Create Railway Project**
   ```bash
   railway login
   railway init
   ```

2. **Add Redis**
   - Go to your Railway project
   - Click "New" → "Database" → "Add Redis"
   - Railway automatically sets `REDIS_URL` environment variable

3. **Set Environment Variables**
   
   In Railway dashboard, go to Variables and add:
   ```
   OPENAI_API_KEY=sk-your-key-here
   NODE_ENV=production
   RATE_LIMIT_MAX=100
   ```

4. **Deploy**
   ```bash
   railway up
   ```

   Or connect your GitHub repo for automatic deployments.

5. **Get Your URL**
   ```bash
   railway domain
   ```

### Railway Configuration

Railway will automatically:
- Detect Node.js and install dependencies
- Use the start script from `package.json`
- Set PORT environment variable
- Provide REDIS_URL from the Redis add-on

### Health Check Setup

In Railway settings, configure:
- **Health Check Path:** `/health`
- **Health Check Timeout:** 10s
- **Restart Policy:** Always

## 📊 Performance Optimizations

### 1. Redis Caching
- **Transcriptions:** Cached for 24 hours (same audio → instant response)
- **Rewrites:** Cached for 7 days (same text + preset → instant response)
- **Speed Improvement:** ~10x faster on cache hits

### 2. Streaming Response
- Progressive text delivery via Server-Sent Events
- Lower perceived latency
- Better user experience

### 3. Compression
- Gzip compression for all responses
- ~70% bandwidth reduction

### 4. Keep-Alive Connections
- Persistent connections reduce overhead
- Optimized timeout settings

### 5. Rate Limiting
- Prevents abuse
- 100 requests per 15 minutes per IP (configurable)

## 🔒 Security Features

- **Helmet.js** - Security headers
- **CORS** - Controlled cross-origin access
- **Rate Limiting** - DDoS protection
- **Input Validation** - Prevents injection attacks
- **File Size Limits** - Prevents resource exhaustion
- **Environment Variables** - No hardcoded secrets

## 🧪 Testing the API

### Test Transcription
```bash
# Create a test audio file or use existing one
curl -X POST http://localhost:3000/api/transcribe \
  -F "audio=@test.wav"
```

### Test Rewrite (Streaming)
```bash
curl -X POST http://localhost:3000/api/rewrite \
  -H "Content-Type: application/json" \
  -d '{
    "text": "hey can you help me with something",
    "presetId": "formal-email"
  }' \
  --no-buffer
```

### Test Rewrite (Batch)
```bash
curl -X POST http://localhost:3000/api/rewrite/batch \
  -H "Content-Type: application/json" \
  -d '{
    "text": "this is a test message",
    "presetId": "magic"
  }'
```

### Test Health
```bash
curl http://localhost:3000/health
```

## 📈 Monitoring

### Stats Endpoint
```bash
curl http://localhost:3000/stats
```

Returns:
- Server uptime
- Memory usage
- Cache statistics
- Node.js version

### Logs

The server logs:
- All requests with duration
- Cache hits/misses
- Errors with stack traces
- Redis connection status

## 🔧 Troubleshooting

### Redis Connection Issues

**Problem:** `Redis: Connection failed`

**Solution:**
1. Verify REDIS_URL is correct
2. Ensure Redis server is running
3. Check firewall/network settings
4. The app will still work without Redis (no caching)

### OpenAI API Errors

**Problem:** `Transcription failed` or `Rewrite failed`

**Solutions:**
1. Verify OPENAI_API_KEY is set and valid
2. Check OpenAI account has credits
3. Ensure API key has correct permissions
4. Check rate limits on OpenAI account

### File Upload Issues

**Problem:** `File too large` or `Invalid file type`

**Solutions:**
1. Audio files must be < 25MB
2. Supported formats: WAV, MP3, M4A, WebM, OGG, FLAC
3. Check file isn't corrupted

### Streaming Not Working

**Problem:** SSE stream doesn't work

**Solutions:**
1. Ensure client supports EventSource or SSE
2. Check CORS settings
3. Verify network doesn't block streaming
4. Use `/api/rewrite/batch` as fallback

## 🏗️ Architecture

```
backend/
├── server.js              # Express app & startup
├── package.json           # Dependencies
├── config/
│   ├── redis.js          # Redis client & connection
│   └── prompts.js        # 30 optimized prompts with examples
├── routes/
│   ├── transcribe.js     # Whisper API endpoint
│   └── rewrite.js        # GPT-4 mini streaming endpoint
└── utils/
    ├── cache.js          # Cache helpers & utilities
    └── openai.js         # OpenAI API client
```

## 🤝 Integration with Flutter App

Update `lib/services/ai_service.dart`:

```dart
class AIService {
  static const String _backendUrl = 'https://your-app.railway.app';
  
  Future<String> transcribeAudio(File audioFile) async {
    final formData = FormData.fromMap({
      'audio': await MultipartFile.fromFile(audioFile.path),
    });
    
    final response = await _dio.post(
      '$_backendUrl/api/transcribe',
      data: formData,
    );
    
    return response.data['text'];
  }
  
  Future<String> rewriteText(String text, Preset preset) async {
    // Use batch endpoint for simplicity
    final response = await _dio.post(
      '$_backendUrl/api/rewrite/batch',
      data: {
        'text': text,
        'presetId': preset.id,
      },
    );
    
    return response.data['text'];
  }
}
```

## 📝 Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | - | OpenAI API key |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL |
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | Environment (production/development) |
| `RATE_LIMIT_MAX` | No | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limit window (15 min) |
| `TRANSCRIPTION_CACHE_TTL` | No | `86400` | Transcription cache TTL (24h) |
| `REWRITE_CACHE_TTL` | No | `604800` | Rewrite cache TTL (7 days) |

## 📄 License

MIT

## 🙏 Credits

- OpenAI Whisper API for transcription
- OpenAI GPT-4 mini for text rewriting
- Express.js for the web framework
- Redis for caching
- Railway for hosting

---

**Built with ❤️ for ViewNami**

