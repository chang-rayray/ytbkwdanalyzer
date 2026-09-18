const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname);
const PORT = 3000;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".cjs": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml"
};

const server = http.createServer((req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost:3000"}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);
    if (pathname === "/") pathname = "/index.html";

    // Block access to .env files or paths containing .env
    if (pathname.toLowerCase().includes(".env")) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("403 Forbidden");
    }

    // Dynamic endpoint mirroring the Vercel serverless function at api/config.js
    if (pathname === "/api/config") {
      let envVars = {};
      const envPath = path.join(root, ".env");
      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
        for (let line of lines) {
          line = line.trim();
          if (line && !line.startsWith("#")) {
            const parts = line.split("=");
            const key = parts[0].trim();
            const val = parts.slice(1).join("=").trim();
            if (key) envVars[key] = val;
          }
        }
      }
      const configBody = "window.APP_CONFIG=" + JSON.stringify({
        youtubeApiKey: envVars.YOUTUBE_API_KEY || "",
        aiProvider: envVars.AI_PROVIDER || "gemini",
        geminiApiKey: envVars.GEMINI_API_KEY || "",
        openaiApiKey: envVars.OPENAI_API_KEY || ""
      }) + ";";

      res.writeHead(200, {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Length": Buffer.byteLength(configBody)
      });
      return res.end(configBody);
    }

    // Path traversal check
    const safePath = path.resolve(root, "." + pathname);
    const relativePath = path.relative(root, safePath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("403 Forbidden");
    }

    // File existence & directory check
    if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("404 Not Found");
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "text/plain";

    res.writeHead(200, { "Content-Type": contentType });
    const stream = fs.createReadStream(safePath);
    stream.on("error", () => {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      }
      res.end("500 Internal Server Error");
    });
    stream.pipe(res);

  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end("400 Bad Request");
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
