import express from "express";
import { healthRouter } from "./routes/health.js";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(express.json());
app.use("/health", healthRouter);

app.listen(port, () => {
  console.log(`TaskFlow API listening on port ${port}`);
});

export { app };
