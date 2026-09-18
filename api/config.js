module.exports = (req, res) => {
  const body = "window.APP_CONFIG=" + JSON.stringify({
    youtubeApiKey: process.env.YOUTUBE_API_KEY || "",
    aiProvider: process.env.AI_PROVIDER || "gemini",
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    openaiApiKey: process.env.OPENAI_API_KEY || ""
  }) + ";";

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(body);
};
