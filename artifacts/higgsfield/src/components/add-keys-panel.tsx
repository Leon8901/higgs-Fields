import { useState } from "react";
import {
  useListProviders,
  useListApiKeys,
  useUpsertApiKey,
  useDeleteApiKey,
  getListApiKeysQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Key } from "lucide-react";
import { ProviderKey } from "./provider-key";

/**
 * "Add Your Keys" panel: fetches the data-driven provider catalog from
 * GET /providers and the user's own saved keys, then renders exactly one
 * <ProviderKey> per provider. Optionally scoped to providers that support a
 * given capability (e.g. only "image" providers on the /image studio).
 */
export function AddYourKeysPanel({ capability }: { capability?: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: providers, isLoading: providersLoading } = useListProviders();
  const { data: keys, isLoading: keysLoading } = useListApiKeys();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const invalidateKeys = () => queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey() });

  const upsert = useUpsertApiKey({
    mutation: {
      onSuccess: (saved) => {
        setErrors((e) => ({ ...e, [saved.provider]: "" }));
        invalidateKeys();
        toast({ title: "API key saved", description: `Your key is ${saved.status === "valid" ? "verified and " : ""}active for this account.` });
      },
      onError: (err: any, vars) => {
        const description = err?.data?.error ?? err?.message ?? "Please check the key and try again.";
        setErrors((e) => ({ ...e, [vars.data.provider]: description }));
      },
    },
  });

  const del = useDeleteApiKey({
    mutation: {
      onSuccess: () => {
        invalidateKeys();
        toast({ title: "API key removed" });
      },
    },
  });

  const filteredProviders = (providers ?? []).filter((p) => !capability || p.capabilities.includes(capability));

  if (providersLoading || keysLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20 bg-white/5 rounded-xl" />
        ))}
      </div>
    );
  }

  if (filteredProviders.length === 0) {
    return <p className="text-sm text-muted-foreground">No providers available yet.</p>;
  }

  return (
    <div className="space-y-3">
      {filteredProviders.map((provider) => (
        <ProviderKey
          key={provider.slug}
          provider={provider}
          savedKey={keys?.find((k) => k.provider === provider.slug)}
          saving={upsert.isPending && upsert.variables?.data.provider === provider.slug}
          deleting={del.isPending && del.variables?.provider === provider.slug}
          error={errors[provider.slug]}
          onSave={(slug, apiKey) => {
            setErrors((e) => ({ ...e, [slug]: "" }));
            upsert.mutate({ data: { provider: slug, apiKey } });
          }}
          onDelete={(slug) => del.mutate({ provider: slug })}
        />
      ))}
    </div>
  );
}

export function AddYourKeysHeading() {
  return (
    <div className="flex items-center gap-2 mb-1">
      <Key className="w-5 h-5 text-primary" />
      <h2 className="text-lg font-bold text-white">Add Your Keys</h2>
    </div>
  );
}
