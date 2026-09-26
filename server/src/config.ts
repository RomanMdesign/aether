export const config = {
  port: Number(process.env.PORT || 4000),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 10),
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  stunUrls: (process.env.STUN_URLS || "stun:stun.l.google.com:19302").split(","),
};
