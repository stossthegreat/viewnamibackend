# 🚀 Deployment Checklist

Quick checklist to get your ViewNami backend live on Railway.

## ✅ Pre-Deployment

- [ ] OpenAI API key ready (get from https://platform.openai.com/api-keys)
- [ ] Railway account created (https://railway.app)
- [ ] Backend code reviewed

## 📦 Railway Deployment Steps

### 1. Create Railway Project
```bash
cd backend
railway login
railway init
```

### 2. Add Redis Database
- In Railway dashboard → Click "New"
- Select "Database" → "Add Redis"
- Railway automatically sets `REDIS_URL` ✅

### 3. Set Environment Variables

In Railway dashboard, go to your service → Variables:

**Required:**
```
OPENAI_API_KEY=sk-proj-your-actual-key-here
```

**Optional (already have good defaults):**
```
NODE_ENV=production
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
```

### 4. Deploy
```bash
railway up
```

**Or** connect GitHub repo for automatic deployments:
- Railway Dashboard → Settings → Connect GitHub Repo

### 5. Get Your Backend URL
```bash
railway domain
```

Copy this URL! You'll need it for Flutter integration.

Example: `https://voicebubble-backend-production.up.railway.app`

### 6. Test Your Deployment

**Health Check:**
```bash
curl https://your-app.railway.app/health
```

**Test Transcription:**
```bash
curl -X POST https://your-app.railway.app/api/transcribe \
  -F "audio=@test.wav"
```

**Test Rewrite:**
```bash
curl -X POST https://your-app.railway.app/api/rewrite/batch \
  -H "Content-Type: application/json" \
  -d '{"text":"hey whats up","presetId":"formal-email"}'
```

## 🔧 Post-Deployment

- [ ] Test `/health` endpoint
- [ ] Test `/api/transcribe` with sample audio
- [ ] Test `/api/rewrite/batch` with different presets
- [ ] Check Railway logs for errors
- [ ] Update Flutter app with backend URL (see INTEGRATION.md)
- [ ] Test Flutter app with new backend

## 📊 Monitoring

**Railway Dashboard:**
- View real-time logs
- Monitor CPU/Memory usage
- Check request metrics
- View deployment history

**Health Check:**
```bash
curl https://your-app.railway.app/health
```

**Stats:**
```bash
curl https://your-app.railway.app/stats
```

## 💰 Cost Optimization

**Railway Free Tier:**
- $5 free credit per month
- Enough for development and testing

**Redis:**
- Caching reduces OpenAI API calls significantly
- Can save 60-80% on API costs for repeated queries

**OpenAI Costs:**
- Whisper: ~$0.006 per minute of audio
- GPT-4 mini: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- Very affordable!

## 🐛 Troubleshooting

### Issue: Deployment Failed

**Check:**
1. `package.json` exists in backend folder
2. Node.js version is 18+ (set in `package.json` engines)
3. All files committed to Git (if using GitHub deployment)

### Issue: Redis Connection Error

**Solution:**
- Ensure Redis add-on is created in Railway
- Check `REDIS_URL` is set automatically
- App works without Redis (just no caching)

### Issue: OpenAI API Errors

**Check:**
1. `OPENAI_API_KEY` is set correctly
2. API key is valid (test at https://platform.openai.com)
3. OpenAI account has credits
4. No typos in the key

### Issue: CORS Errors

**Solution:**
- Backend already configured for CORS
- Add your domain to CORS whitelist in `server.js` if needed
- Railway domains are allowed by default

## 📝 Environment Variables Reference

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `OPENAI_API_KEY` | ✅ Yes | - | Get from OpenAI |
| `REDIS_URL` | Auto | Auto-set | Railway sets this |
| `PORT` | Auto | 3000 | Railway sets this |
| `NODE_ENV` | No | production | Set to production |
| `RATE_LIMIT_MAX` | No | 100 | Requests per 15 min |

## 🎯 Success Criteria

Your deployment is successful when:

✅ `/health` returns status 200 with all services healthy
✅ Audio transcription works (test with sample file)
✅ Text rewriting works (test with different presets)
✅ Redis shows as "connected" in health check
✅ Logs show no errors
✅ Flutter app can communicate with backend

## 🚀 Next Steps

1. ✅ Deploy backend to Railway
2. ✅ Test all endpoints
3. ✅ Update Flutter app (see INTEGRATION.md)
4. ✅ Test Flutter + Backend together
5. 🎉 Ship it!

## 📚 Helpful Links

- [Railway Docs](https://docs.railway.app)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Redis Docs](https://redis.io/docs)
- Backend README.md (this repo)
- INTEGRATION.md (Flutter integration)

---

**Need help? Check the logs in Railway dashboard or review the troubleshooting section above.**

Good luck! 🚀

