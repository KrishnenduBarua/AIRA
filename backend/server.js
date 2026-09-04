require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { port, corsOrigins } = require("./src/config");
const { mlServiceUrl } = require("./src/config");

const authRoutes = require("./src/routes/auth");
const statementRoutes = require("./src/routes/statements");
const scoreRoutes = require("./src/routes/score");
const lenderRoutes = require("./src/routes/lender");
const chatRoutes = require("./src/routes/chat");
const loanRoutes = require("./src/routes/loans");
const { initDatabase } = require("./src/data/db");

const app = express();

const localFrontendOrigin =
  /^http:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):4173$/;

app.use(
  cors({
    origin(origin, callback) {
      const normalizedOrigin = origin?.replace(/\/+$/, "");
      if (
        !origin ||
        localFrontendOrigin.test(normalizedOrigin) ||
        corsOrigins.includes(normalizedOrigin)
      ) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "aira-backend" });
});

app.get("/health/dependencies", async (req, res) => {
  try {
    const response = await fetch(`${mlServiceUrl}/health`, {
      signal: AbortSignal.timeout(10000),
    });
    const body = await response.text();
    return res.status(response.ok ? 200 : 503).json({
      status: response.ok ? "ok" : "error",
      mlServiceUrl,
      mlStatus: response.status,
      mlBody: body.slice(0, 500),
    });
  } catch (error) {
    return res.status(503).json({
      status: "error",
      mlServiceUrl,
      error: error.code || error.message,
    });
  }
});

app.use("/auth", authRoutes);
app.use("/statements", statementRoutes);
app.use("/score", scoreRoutes);
app.use("/lender", lenderRoutes);
app.use("/chat", chatRoutes);
app.use("/loans", loanRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ message: "Internal server error.", details: err.message });
});

initDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`AIRA backend running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Database initialization failed:", error.message);
    process.exit(1);
  });
