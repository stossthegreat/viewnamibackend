// Universal post normalizer — handles ANY data format from ANY Apify actor

export function normalizePost(item, platform) {
  if (!item || typeof item !== "object") return null;

  // Extract what we can from any format
  const post = {
    author: findField(item, ["ownerUsername", "authorMeta.name", "author.userName", "author.name", "author", "user.screen_name", "channelName", "channel.name", "pageName", "user.name"]),
    followers: findNumber(item, ["ownerFollowerCount", "authorMeta.fans", "authorStats.followerCount", "author.followers", "user.followers_count", "channelSubscribers", "channel.subscribers", "authorFollowers", "pageFollowers"]),
    caption: findField(item, ["caption", "text", "desc", "title", "full_text", "postText", "content", "message", "body", "selftext"]) || "",
    views: findNumber(item, ["playCount", "stats.playCount", "plays", "videoViewCount", "videoPlayCount", "viewCount", "views"]),
    likes: findNumber(item, ["diggCount", "stats.diggCount", "likes", "likesCount", "likeCount", "favorite_count", "reactions", "numLikes", "score", "ups"]),
    comments: findNumber(item, ["commentCount", "stats.commentCount", "comments", "commentsCount", "replyCount", "num_comments", "numberOfComments"]),
    shares: findNumber(item, ["shareCount", "stats.shareCount", "shares", "retweetCount", "retweet_count", "reposts"]),
    saves: findNumber(item, ["collectCount", "stats.collectCount", "bookmarkCount"]),
    hashtags: extractHashtags(item),
    sound: findField(item, ["musicMeta.musicName", "music.title", "musicInfo.title"]),
    duration: findNumber(item, ["videoMeta.duration", "video.duration", "videoDuration", "duration"]),
    posted_date: extractDate(item),
    url: findField(item, ["webVideoUrl", "url", "postUrl", "shortCode"]),
    subreddit: findField(item, ["subreddit", "communityName"]),
    author_title: findField(item, ["authorTitle", "authorHeadline"]),
  };

  // Fix URL for Instagram shortcodes
  if (post.url && !post.url.startsWith("http") && post.url.length < 20) {
    post.url = `https://instagram.com/p/${post.url}`;
  }

  // Fix author format
  if (post.author && !post.author.startsWith("@") && !post.author.startsWith("u/") && platform !== "reddit") {
    post.author = `@${post.author}`;
  }
  if (platform === "reddit" && post.author && !post.author.startsWith("u/")) {
    post.author = `u/${post.author}`;
  }

  // Must have at least a caption or some engagement to be useful
  if (!post.caption && !post.likes && !post.views) return null;

  return post;
}

function findField(obj, paths) {
  for (const path of paths) {
    const parts = path.split(".");
    let val = obj;
    for (const part of parts) {
      if (val == null) break;
      val = val[part];
    }
    if (val != null && val !== "" && val !== 0) {
      return typeof val === "string" ? val : String(val);
    }
  }
  return null;
}

function findNumber(obj, paths) {
  for (const path of paths) {
    const parts = path.split(".");
    let val = obj;
    for (const part of parts) {
      if (val == null) break;
      val = val[part];
    }
    if (typeof val === "number" && val > 0) return val;
    if (typeof val === "string") {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return 0;
}

function extractHashtags(item) {
  // Try multiple hashtag field formats
  const raw = item.hashtags || item.entities?.hashtags || item.tags || [];
  if (!Array.isArray(raw)) return [];
  return raw.map(h => {
    if (typeof h === "string") return h.startsWith("#") ? h : `#${h}`;
    if (h.name) return `#${h.name}`;
    if (h.title) return `#${h.title}`;
    if (h.text) return `#${h.text}`;
    return null;
  }).filter(Boolean);
}

function extractDate(item) {
  // Try multiple date formats
  const raw = item.createTimeISO || item.timestamp || item.createdAt || item.createTime || item.postedAt || item.date || item.uploadDate || item.publishedAt || item.time;
  if (!raw) return null;
  try {
    if (typeof raw === "number") {
      // Unix timestamp — could be seconds or milliseconds
      const d = raw > 1e12 ? new Date(raw) : new Date(raw * 1000);
      return d.toISOString().split("T")[0];
    }
    return new Date(raw).toISOString().split("T")[0];
  } catch (e) {
    return null;
  }
}

export default { normalizePost };
