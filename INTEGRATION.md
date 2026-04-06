# Flutter Integration Guide

How to integrate the ViewNami backend with your Flutter app.

## Quick Start

After deploying to Railway, update your Flutter app to use the backend API instead of calling OpenAI directly.

## Step 1: Get Your Backend URL

After Railway deployment:
```bash
railway domain
```

Your URL will be something like: `https://voicebubble-backend-production.up.railway.app`

## Step 2: Update Flutter AIService

Update `/lib/services/ai_service.dart`:

```dart
import 'dart:io';
import 'package:dio/dio.dart';
import '../models/preset.dart';

class AIService {
  // Replace with your Railway backend URL
  static const String _backendUrl = 'https://your-app.up.railway.app';
  final Dio _dio = Dio();
  
  AIService() {
    _dio.options.headers = {
      'Content-Type': 'application/json',
    };
    _dio.options.connectTimeout = const Duration(seconds: 60);
    _dio.options.receiveTimeout = const Duration(seconds: 60);
  }
  
  /// Convert audio file to text using backend Whisper API
  Future<String> transcribeAudio(File audioFile) async {
    try {
      final formData = FormData.fromMap({
        'audio': await MultipartFile.fromFile(
          audioFile.path,
          filename: 'audio.wav',
        ),
      });
      
      final response = await _dio.post(
        '$_backendUrl/api/transcribe',
        data: formData,
        options: Options(
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        ),
      );
      
      return response.data['text'] ?? '';
    } catch (e) {
      throw Exception('Failed to transcribe audio: $e');
    }
  }
  
  /// Rewrite text using backend GPT-4 mini API
  Future<String> rewriteText(String text, Preset preset) async {
    try {
      // Use batch endpoint for simplicity (non-streaming)
      final response = await _dio.post(
        '$_backendUrl/api/rewrite/batch',
        data: {
          'text': text,
          'presetId': preset.id,
        },
      );
      
      return response.data['text'] ?? '';
    } catch (e) {
      throw Exception('Failed to rewrite text: $e');
    }
  }
}
```

## Step 3: (Optional) Add Streaming Support

For real-time streaming (advanced):

### Add SSE Package

Add to `pubspec.yaml`:
```yaml
dependencies:
  flutter_client_sse: ^2.0.1
```

### Update AIService with Streaming

```dart
import 'package:flutter_client_sse/flutter_client_sse.dart';

class AIService {
  // ... existing code ...
  
  /// Rewrite text with streaming (real-time updates)
  Stream<String> rewriteTextStreaming(String text, Preset preset) async* {
    try {
      final url = '$_backendUrl/api/rewrite';
      
      final stream = SSEClient.subscribeToSSE(
        method: SSERequestType.POST,
        url: url,
        header: {
          'Content-Type': 'application/json',
        },
        body: {
          'text': text,
          'presetId': preset.id,
        },
      );

      String fullText = '';
      
      await for (var event in stream) {
        if (event.data != null && event.data!.isNotEmpty) {
          try {
            final data = jsonDecode(event.data!);
            
            if (data['type'] == 'done') {
              yield data['text'];
              break;
            } else if (data['chunk'] != null) {
              fullText += data['chunk'];
              yield fullText; // Yield accumulated text
            }
          } catch (e) {
            print('Error parsing SSE event: $e');
          }
        }
      }
    } catch (e) {
      throw Exception('Failed to rewrite text: $e');
    }
  }
}
```

### Update UI to Show Streaming

In `result_screen.dart`:

```dart
// Instead of waiting for complete result:
String result = await aiService.rewriteText(text, preset);

// Use streaming:
await for (final chunk in aiService.rewriteTextStreaming(text, preset)) {
  setState(() {
    _resultText = chunk; // Update UI progressively
  });
}
```

## Step 4: Update Environment Configuration

For different environments (dev/prod), create a config file:

### Create `lib/config/api_config.dart`:

```dart
class ApiConfig {
  static const bool useProduction = true; // Toggle for dev/prod
  
  static String get backendUrl {
    if (useProduction) {
      return 'https://your-app.up.railway.app';
    } else {
      return 'http://localhost:3000'; // Local development
    }
  }
}
```

### Update AIService:

```dart
import '../config/api_config.dart';

class AIService {
  static String get _backendUrl => ApiConfig.backendUrl;
  // ... rest of code
}
```

## Step 5: Test Integration

### Test Locally

1. Run backend locally:
   ```bash
   cd backend
   npm start
   ```

2. Update Flutter config to use local URL:
   ```dart
   static const bool useProduction = false;
   ```

3. Run Flutter app and test

### Test on Railway

1. Deploy backend to Railway
2. Update Flutter config with Railway URL
3. Test all features:
   - Voice transcription
   - Text rewriting with different presets
   - Check for errors

## Benefits of Using Backend

### Before (Direct OpenAI Calls)
- ❌ API keys exposed in app
- ❌ No caching (slow, expensive)
- ❌ Limited control over prompts
- ❌ Can't update prompts without app update

### After (Backend API)
- ✅ API keys secure on server
- ✅ Redis caching (10x faster on cache hits)
- ✅ Optimized prompts with few-shot learning
- ✅ Update prompts anytime without app update
- ✅ Better monitoring and analytics
- ✅ Rate limiting protection
- ✅ Streaming for better UX (optional)

## Performance Tips

1. **Cache Management**
   - Backend caches identical requests
   - Transcriptions cached 24 hours
   - Rewrites cached 7 days
   - Cache hits are ~10x faster

2. **Error Handling**
   - Backend returns structured errors
   - Handle network failures gracefully
   - Show user-friendly error messages

3. **Loading States**
   - Show progress indicators
   - With streaming: show partial results
   - Without streaming: show spinner

## Troubleshooting

### Issue: "Failed to transcribe audio"
**Solution:** Check audio file format (WAV, MP3, M4A) and size (<25MB)

### Issue: "Failed to rewrite text"
**Solution:** Verify backend URL is correct and server is running

### Issue: Network timeout
**Solution:** Increase timeout in Dio configuration:
```dart
_dio.options.connectTimeout = const Duration(seconds: 90);
_dio.options.receiveTimeout = const Duration(seconds: 90);
```

### Issue: CORS errors (web)
**Solution:** Backend already configured for CORS. Ensure Railway URL is accessible.

## Next Steps

1. ✅ Deploy backend to Railway
2. ✅ Get backend URL
3. ✅ Update Flutter AIService
4. ✅ Test locally
5. ✅ Test on Railway
6. ✅ Update app with production URL
7. ✅ Remove OpenAI API key from Flutter app
8. 🚀 Deploy Flutter app!

## Support

If you encounter issues:
1. Check backend `/health` endpoint
2. Check Railway logs
3. Verify environment variables are set
4. Test with curl commands from README

---

**You're all set! Your ViewNami app is now powered by a fast, secure backend! 🚀**

