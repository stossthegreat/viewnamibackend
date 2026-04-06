// backend/routes/viral.js

import { Router } from "express";
import { runFullScrape, getScrapeStatus } from "../viral/autoScrape.js";

const router = Router();

// GET /api/viral/status — What data do we have?
router.get("/status", (req, res) => {
  const status = getScrapeStatus();
  res.json(status);
});

// POST /api/viral/auto — ONE BUTTON. Scrapes everything. Fully automated.
router.post("/auto", async (req, res, next) => {
  try {
    if (!process.env.APIFY_API_TOKEN) {
      return res.status(400).json({
        error: "APIFY_API_TOKEN not set. Add it to your environment variables on Railway.",
      });
    }

    // Respond immediately — scraping runs in background
    res.json({
      message: "Full auto scrape started — 10 niches, 30 scrapes, 100 posts each",
      status: "running",
      jobs: 30,
      note: "Check GET /api/viral/status for progress",
    });

    // Run in background
    runFullScrape().then(results => {
      const succeeded = Object.values(results).filter(r => r.success).length;
      console.log(`\n🔥 AUTO SCRAPE DONE — ${succeeded}/30 succeeded\n`);
    }).catch(err => {
      console.error("❌ Auto scrape failed:", err.message);
    });

  } catch (err) {
    next(err);
  }
});

export default router;
