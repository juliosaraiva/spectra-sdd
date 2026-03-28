import { Router } from "express";

const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({ status: "ok", version: "0.1.0" });
});

export { healthRouter };
