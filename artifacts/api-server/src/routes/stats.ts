import { Router, type IRouter } from "express";
import { GetPlatformStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  // Static platform stats — update as the platform grows
  res.json(
    GetPlatformStatsResponse.parse({
      videosGenerated: 12500000,
      activeCreators: 520000,
      communityApps: 3847,
      modelsAvailable: 24,
    }),
  );
});

export default router;
