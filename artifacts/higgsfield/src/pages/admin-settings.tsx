import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Show } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings, ShieldAlert, Save, Loader2 } from "lucide-react";
import { useGetMe, useGetAdminSettings, useUpdateAdminSettings } from "@workspace/api-client-react";
import type { AdminSetting } from "@workspace/api-client-react";
import { toast } from "@/hooks/use-toast";

const CATEGORY_LABELS: Record<string, string> = {
  branding: "Branding",
  access: "Access",
  credits: "Credits",
  defaults: "Model defaults",
  content: "Content",
};

interface BannerValue {
  enabled: boolean;
  text: string;
  linkUrl?: string;
  linkLabel?: string;
}

function isBannerValue(value: unknown): value is BannerValue {
  return typeof value === "object" && value !== null && "enabled" in value && "text" in value;
}

function SettingField({
  setting,
  value,
  onChange,
}: {
  setting: AdminSetting;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (setting.type === "boolean") {
    return (
      <div className="flex items-center justify-between gap-4 py-3">
        <div>
          <Label className="text-white text-sm font-semibold">{setting.label}</Label>
          <p className="text-xs text-white/40 mt-0.5">{setting.description}</p>
        </div>
        <Switch checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked)} />
      </div>
    );
  }

  if (setting.type === "number") {
    return (
      <div className="py-3">
        <Label className="text-white text-sm font-semibold">{setting.label}</Label>
        <p className="text-xs text-white/40 mt-0.5 mb-2">{setting.description}</p>
        <Input
          type="number"
          min={0}
          value={typeof value === "number" ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="bg-white/[0.04] border-white/10 text-white max-w-xs"
        />
      </div>
    );
  }

  if (setting.type === "json" && isBannerValue(value)) {
    const banner = value;
    return (
      <div className="py-3 border-t border-white/[0.06] first:border-t-0">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <Label className="text-white text-sm font-semibold">{setting.label}</Label>
            <p className="text-xs text-white/40 mt-0.5">{setting.description}</p>
          </div>
          <Switch
            checked={banner.enabled}
            onCheckedChange={(checked) => onChange({ ...banner, enabled: checked })}
          />
        </div>
        <div className="grid gap-2 max-w-lg">
          <Input
            placeholder="Banner text"
            value={banner.text}
            onChange={(e) => onChange({ ...banner, text: e.target.value })}
            className="bg-white/[0.04] border-white/10 text-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Link URL (optional)"
              value={banner.linkUrl ?? ""}
              onChange={(e) => onChange({ ...banner, linkUrl: e.target.value })}
              className="bg-white/[0.04] border-white/10 text-white"
            />
            <Input
              placeholder="Link label (optional)"
              value={banner.linkLabel ?? ""}
              onChange={(e) => onChange({ ...banner, linkLabel: e.target.value })}
              className="bg-white/[0.04] border-white/10 text-white"
            />
          </div>
        </div>
      </div>
    );
  }

  // Default: string
  const isLong = typeof value === "string" && (value.length > 80 || setting.key.includes("message"));
  return (
    <div className="py-3">
      <Label className="text-white text-sm font-semibold">{setting.label}</Label>
      <p className="text-xs text-white/40 mt-0.5 mb-2">{setting.description}</p>
      {isLong ? (
        <Textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="bg-white/[0.04] border-white/10 text-white max-w-xl"
          rows={3}
        />
      ) : (
        <Input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="bg-white/[0.04] border-white/10 text-white max-w-xl"
        />
      )}
    </div>
  );
}

function AdminSettingsPanel() {
  const { data: settings, isLoading } = useGetAdminSettings();
  const updateMutation = useUpdateAdminSettings();
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!settings) return;
    const initial: Record<string, unknown> = {};
    for (const s of settings) initial[s.key] = s.value;
    setDraft(initial);
  }, [settings]);

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center py-24 text-white/40">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading settings…
      </div>
    );
  }

  const grouped = new Map<string, AdminSetting[]>();
  for (const s of settings) {
    if (!grouped.has(s.category)) grouped.set(s.category, []);
    grouped.get(s.category)!.push(s);
  }

  const handleSave = () => {
    const patch: Record<string, unknown> = {};
    for (const key of dirty) patch[key] = draft[key];
    if (Object.keys(patch).length === 0) return;

    updateMutation.mutate(
      { data: patch },
      {
        onSuccess: () => {
          toast({ title: "Settings saved" });
          setDirty(new Set());
        },
        onError: (err: unknown) => {
          toast({ title: "Failed to save settings", description: String(err), variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="space-y-8">
      {[...grouped.entries()].map(([category, defs]) => (
        <div key={category} className="bg-[#141414] border border-white/[0.08] rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-1">{CATEGORY_LABELS[category] ?? category}</h2>
          <div className="divide-y divide-white/[0.06]">
            {defs.map((s) => (
              <SettingField
                key={s.key}
                setting={s}
                value={draft[s.key]}
                onChange={(value) => {
                  setDraft((prev) => ({ ...prev, [s.key]: value }));
                  setDirty((prev) => new Set(prev).add(s.key));
                }}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="sticky bottom-6 flex justify-end">
        <Button
          onClick={handleSave}
          disabled={dirty.size === 0 || updateMutation.isPending}
          className="bg-primary text-black font-bold hover:bg-primary/90 shadow-lg"
        >
          {updateMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-1.5" />
          )}
          Save changes {dirty.size > 0 ? `(${dirty.size})` : ""}
        </Button>
      </div>
    </div>
  );
}

function Forbidden() {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-4 py-24">
      <ShieldAlert className="w-10 h-10 text-white/30" />
      <h1 className="text-2xl font-black text-white">Owner access required</h1>
      <p className="text-muted-foreground text-sm max-w-sm">
        This page is only available to the site owner.
      </p>
      <Link href="/">
        <Button variant="ghost" className="text-white/70 hover:text-white">
          Back home
        </Button>
      </Link>
    </div>
  );
}

export default function AdminSettings() {
  const { data: me, isLoading } = useGetMe();

  return (
    <div className="container mx-auto px-4 py-12 min-h-screen max-w-screen-lg">
      <Show when="signed-out">
        <div className="flex flex-col items-center justify-center text-center gap-6 py-24">
          <h1 className="text-3xl md:text-4xl font-black text-white">Sign in to continue</h1>
          <Link href="/sign-in">
            <Button className="bg-primary text-black font-bold hover:bg-primary/90">Log in</Button>
          </Link>
        </div>
      </Show>

      <Show when="signed-in">
        <div className="flex items-center gap-3 mb-8">
          <Settings className="w-7 h-7 text-primary shrink-0" />
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white leading-none">Site Settings</h1>
            <p className="text-muted-foreground text-sm mt-1">Owner-only platform configuration.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-white/40">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : me?.isOwner ? (
          <AdminSettingsPanel />
        ) : (
          <Forbidden />
        )}
      </Show>
    </div>
  );
}
