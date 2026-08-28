const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { port } = require("./src/config");

const authRoutes = require("./src/routes/auth");
const statementRoutes = require("./src/routes/statements");
const scoreRoutes = require("./src/routes/score");
const lenderRoutes = require("./src/routes/lender");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "aira-backend" });
});

app.use("/auth", authRoutes);
app.use("/statements", statementRoutes);
app.use("/score", scoreRoutes);
app.use("/lender", lenderRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ message: "Internal server error.", details: err.message });
});

app.listen(port, () => {
  console.log(`AIRA backend running on http://localhost:${port}`);
});
