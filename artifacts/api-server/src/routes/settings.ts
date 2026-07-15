import { Router, type IRouter } from "express";
import { GetPublicSettingsResponse, GetAdminSettingsResponse, UpdateAdminSettingsBody, UpdateAdminSettingsResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOwner } from "../middlewares/requireOwner";
import { getPublicSettings, getAdminSettings, updateSettings } from "../lib/settings";

const router: IRouter = Router();

router.get("/settings", async (_req, res): Promise<void> => {
  const settings = await getPublicSettings();
  res.json(GetPublicSettingsResponse.parse(settings));
});

router.get("/admin/settings", requireAuth, requireOwner, async (_req, res): Promise<void> => {
  const settings = await getAdminSettings();
  res.json(GetAdminSettingsResponse.parse(settings));
});

router.patch("/admin/settings", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const body = UpdateAdminSettingsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const result = await updateSettings(body.data);
  if (!result.ok) {
    res.status(400).json({ error: "Validation failed", fields: result.errors });
    return;
  }

  const settings = await getAdminSettings();
  res.json(UpdateAdminSettingsResponse.parse(settings));
});

export default router;
