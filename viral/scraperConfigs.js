// ============================================================
//   SCRAPER CONFIGS — APIFY ACTOR DEFINITIONS
// ============================================================
//
// Each platform has:
// - actorId: The Apify actor to run
// - buildInput(): Returns the input config for that actor
// - viralThreshold: Minimum engagement to be considered "viral"
// - mapResult(): Normalizes actor output to our standard format
//
// ============================================================

export const SCRAPER_CONFIGS = {

  // ══════════════════════════════════════
  // TIKTOK
  // ══════════════════════════════════════
  tiktok: {
    actorId: "clockworks/tiktok-scraper",
    niches: {
      general: ["#fyp", "#viral", "#trending", "#foryou"],
      fitness: ["#gymtok", "#fitness", "#workout", "#gym", "#fitnesstiktok"],
      food: ["#foodtok", "#recipe", "#cooking", "#foodie", "#cooktok"],
      business: ["#entrepreneur", "#business", "#startup", "#sidehustle", "#money"],
      beauty: ["#beautytok", "#skincare", "#makeup", "#grwm", "#beauty"],
      tech: ["#techtok", "#coding", "#tech", "#ai", "#programming"],
      comedy: ["#comedy", "#funny", "#relatable", "#storytime", "#humor"],
      finance: ["#moneytok", "#investing", "#personalfinance", "#stocks", "#crypto"],
      lifestyle: ["#dayinmylife", "#vlog", "#aesthetic", "#routine", "#life"],
    },
    buildInput(hashtags, limit = 200) {
      return {
        hashtags,
        resultsPerPage: limit,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      };
    },
    viralThreshold: { views: 100000 },
    mapResult(item) {
      return {
        author: item.authorMeta?.name ? `@${item.authorMeta.name}` : (item.author || "unknown"),
        followers: item.authorMeta?.fans || item.authorStats?.followerCount || 0,
        caption: item.text || item.desc || "",
        views: item.playCount || item.stats?.playCount || item.plays || 0,
        likes: item.diggCount || item.stats?.diggCount || item.likes || 0,
        comments: item.commentCount || item.stats?.commentCount || item.comments || 0,
        shares: item.shareCount || item.stats?.shareCount || item.shares || 0,
        saves: item.collectCount || item.stats?.collectCount || 0,
        hashtags: (item.hashtags || []).map(h => typeof h === "string" ? `#${h}` : `#${h.name || h.title || ""}`),
        sound: item.musicMeta?.musicName || item.music?.title || null,
        duration: item.videoMeta?.duration || item.video?.duration || 0,
        posted_date: item.createTimeISO || (item.createTime ? new Date(item.createTime * 1000).toISOString().split("T")[0] : null),
        posted_time: item.createTimeISO ? new Date(item.createTimeISO).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : null,
        url: item.webVideoUrl || item.url || null,
      };
    },
  },

  // ══════════════════════════════════════
  // INSTAGRAM
  // ══════════════════════════════════════
  instagram: {
    actorId: "apify/instagram-hashtag-scraper",
    niches: {
      general: ["#viral", "#trending", "#explore", "#instagood"],
      fitness: ["#fitness", "#gym", "#workout", "#fitnessmotivation", "#gymlife"],
      food: ["#food", "#foodporn", "#recipe", "#cooking", "#healthyfood"],
      business: ["#business", "#entrepreneur", "#success", "#marketing"],
      beauty: ["#beauty", "#skincare", "#makeup", "#beautytips", "#selfcare"],
      tech: ["#tech", "#technology", "#coding", "#ai", "#innovation"],
      lifestyle: ["#lifestyle", "#aesthetic", "#ootd", "#daily", "#mood"],
    },
    buildInput(hashtags, limit = 200) {
      return {
        hashtags,
        resultsLimit: limit,
      };
    },
    viralThreshold: { likes: 5000 },
    mapResult(item) {
      return {
        author: item.ownerUsername ? `@${item.ownerUsername}` : (item.owner?.username ? `@${item.owner.username}` : "unknown"),
        followers: item.ownerFollowerCount || 0,
        caption: item.caption || "",
        views: item.videoViewCount || item.videoPlayCount || item.likesCount || 0,
        likes: item.likesCount || 0,
        comments: item.commentsCount || 0,
        shares: 0,
        saves: 0,
        hashtags: (item.hashtags || []).map(h => `#${h}`),
        sound: item.musicInfo?.title || null,
        duration: item.videoDuration || 0,
        posted_date: item.timestamp ? new Date(item.timestamp * 1000).toISOString().split("T")[0] : null,
        posted_time: item.timestamp ? new Date(item.timestamp * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : null,
        url: item.url || item.shortCode ? `https://instagram.com/p/${item.shortCode}` : null,
        type: item.type || (item.isVideo ? "reel" : "post"),
      };
    },
  },

  // ══════════════════════════════════════
  // X (TWITTER)
  // ══════════════════════════════════════
  x: {
    actorId: "apidojo/tweet-scraper",
    niches: {
      general: ['"went viral" min_faves:2000', '"nobody talks about" min_faves:1000', '"unpopular opinion" min_faves:3000'],
      fitness: ['"gym" OR "workout" OR "fitness" min_faves:1000'],
      food: ['"recipe" OR "cooking" OR "food" min_faves:1000'],
      business: ['"startup" OR "entrepreneur" OR "business" min_faves:1000'],
      tech: ['"coding" OR "tech" OR "AI" min_faves:1000'],
      finance: ['"investing" OR "stocks" OR "money" min_faves:1000'],
    },
    buildInput(queries, limit = 500) {
      return {
        searchTerms: queries,
        maxTweets: limit,
        sort: "Top",
      };
    },
    viralThreshold: { likes: 1000 },
    mapResult(item) {
      return {
        author: item.author?.userName ? `@${item.author.userName}` : (item.user?.screen_name ? `@${item.user.screen_name}` : "unknown"),
        followers: item.author?.followers || item.user?.followers_count || 0,
        caption: item.text || item.full_text || "",
        views: item.viewCount || item.views || 0,
        likes: item.likeCount || item.favorite_count || 0,
        comments: item.replyCount || 0,
        shares: item.retweetCount || item.retweet_count || 0,
        saves: item.bookmarkCount || 0,
        hashtags: (item.entities?.hashtags || []).map(h => `#${h.text || h}`),
        posted_date: item.createdAt ? new Date(item.createdAt).toISOString().split("T")[0] : null,
        posted_time: item.createdAt ? new Date(item.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : null,
        url: item.url || null,
        is_thread: item.isThread || item.conversationCount > 1 || false,
      };
    },
  },

  // ══════════════════════════════════════
  // REDDIT
  // ══════════════════════════════════════
  reddit: {
    actorId: "trudax/reddit-scraper",
    niches: {
      general: ["r/all", "r/popular", "r/todayilearned", "r/lifeprotips"],
      fitness: ["r/fitness", "r/gym", "r/bodybuilding", "r/running"],
      food: ["r/food", "r/cooking", "r/recipes", "r/mealprep"],
      business: ["r/entrepreneur", "r/startups", "r/smallbusiness"],
      tech: ["r/technology", "r/programming", "r/webdev", "r/artificial"],
      finance: ["r/personalfinance", "r/investing", "r/financialindependence"],
    },
    buildInput(subreddits, limit = 200) {
      return {
        startUrls: subreddits.map(s => ({
          url: s.startsWith("r/") ? `https://reddit.com/${s}/top/?t=month` : s,
        })),
        maxItems: limit,
        sort: "top",
      };
    },
    viralThreshold: { likes: 500 },
    mapResult(item) {
      return {
        author: item.author ? `u/${item.author}` : "unknown",
        followers: 0,
        caption: item.title || "",
        body: item.body || item.selftext || "",
        views: 0,
        likes: item.score || item.ups || 0,
        comments: item.numberOfComments || item.num_comments || 0,
        shares: 0,
        saves: 0,
        hashtags: [],
        subreddit: item.subreddit || item.communityName || "",
        posted_date: item.createdAt ? new Date(item.createdAt).toISOString().split("T")[0] : null,
        url: item.url || null,
        awards: item.awards || item.totalAwards || 0,
      };
    },
  },

  // ══════════════════════════════════════
  // LINKEDIN
  // ══════════════════════════════════════
  linkedin: {
    actorId: "curious_coder/linkedin-post-search-scraper",
    niches: {
      general: ['"I got fired"', '"lesson I learned"', '"unpopular opinion"', '"hot take"'],
      business: ['"startup"', '"entrepreneur"', '"leadership"', '"hiring"'],
      tech: ['"software engineer"', '"AI"', '"coding"', '"tech industry"'],
      marketing: ['"marketing"', '"content strategy"', '"social media"', '"branding"'],
    },
    buildInput(queries, limit = 200) {
      return {
        searchTerms: queries,
        maxResults: limit,
      };
    },
    viralThreshold: { likes: 100 },
    mapResult(item) {
      return {
        author: item.authorName || item.author || "unknown",
        followers: item.authorFollowers || 0,
        caption: item.text || item.postText || item.content || "",
        views: 0,
        likes: item.reactions || item.likeCount || item.numLikes || 0,
        comments: item.comments || item.commentCount || item.numComments || 0,
        shares: item.reposts || item.repostCount || 0,
        saves: 0,
        hashtags: [],
        posted_date: item.postedAt || item.date || null,
        url: item.postUrl || item.url || null,
        author_title: item.authorTitle || item.authorHeadline || "",
      };
    },
  },

  // ══════════════════════════════════════
  // YOUTUBE
  // ══════════════════════════════════════
  youtube: {
    actorId: "streamers/youtube-scraper",
    niches: {
      general: ["trending shorts", "viral videos 2026"],
      fitness: ["fitness shorts", "gym workout tips", "home workout"],
      food: ["cooking shorts", "recipe hack", "food asmr"],
      business: ["business advice shorts", "entrepreneur tips"],
      tech: ["tech review shorts", "coding tutorial", "AI explained"],
    },
    buildInput(queries, limit = 200) {
      return {
        searchKeywords: queries,
        maxResults: limit,
        type: "video",
        sortBy: "viewCount",
      };
    },
    viralThreshold: { views: 50000 },
    mapResult(item) {
      return {
        author: item.channelName || item.channel?.name || "unknown",
        followers: item.channelSubscribers || item.channel?.subscribers || 0,
        caption: item.title || "",
        description: item.description || "",
        views: item.viewCount || item.views || 0,
        likes: item.likeCount || item.likes || 0,
        comments: item.commentCount || item.comments || 0,
        shares: 0,
        saves: 0,
        hashtags: (item.tags || []).map(t => `#${t}`),
        duration: item.duration || 0,
        posted_date: item.uploadDate || item.publishedAt || null,
        url: item.url || (item.id ? `https://youtube.com/watch?v=${item.id}` : null),
        thumbnail: item.thumbnailUrl || null,
      };
    },
  },

  // ══════════════════════════════════════
  // FACEBOOK
  // ══════════════════════════════════════
  facebook: {
    actorId: "apify/facebook-posts-scraper",
    niches: {
      general: [],
    },
    buildInput(pageUrls, limit = 200) {
      return {
        startUrls: pageUrls.map(u => ({ url: u })),
        maxPosts: limit,
      };
    },
    viralThreshold: { likes: 1000 },
    mapResult(item) {
      return {
        author: item.pageName || item.user?.name || "unknown",
        followers: item.pageFollowers || 0,
        caption: item.text || item.message || "",
        views: item.videoViews || 0,
        likes: item.likes || item.reactions || 0,
        comments: item.comments || 0,
        shares: item.shares || 0,
        saves: 0,
        hashtags: [],
        posted_date: item.time ? new Date(item.time).toISOString().split("T")[0] : null,
        url: item.postUrl || item.url || null,
        type: item.type || "post",
      };
    },
  },
};

export default SCRAPER_CONFIGS;
