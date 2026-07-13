import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { Key, X } from "lucide-react";
import { ProviderKey } from "./provider-key";

/**
 * Fetches the data-driven provider catalog from GET /providers and the
 * user's own saved keys, then renders exactly one <ProviderKey> per
 * provider. Optionally scoped to providers that support a given capability
 * (e.g. only "image" providers on the /image studio).
 */
export function AddYourKeysList({ capability }: { capability?: string }) {
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

/**
 * "Add Your Keys" modal — same overlay/card pattern as UrlToAdModal in
 * marketing-studio.tsx (icon, headline, description, list content, close
 * button, centered backdrop-blurred overlay). This is the single entry
 * point for BYOK key management; there is no inline/account-page variant.
 */
export function AddYourKeysModal({
  open,
  onClose,
  capability,
}: {
  open: boolean;
  onClose: () => void;
  capability?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[560px] max-h-[85vh] rounded-2xl overflow-hidden border border-white/[0.1] shadow-2xl shadow-black/80 flex flex-col"
            style={{ background: "#141414" }}
          >
            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.14] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-8 md:p-10 overflow-y-auto">
              {/* Header */}
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center mb-6 shadow-lg shadow-pink-900/30">
                <Key className="w-6 h-6 text-white" />
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-3">
                Add your own keys.
              </h2>
              <p className="text-sm text-white/50 leading-relaxed max-w-sm mb-8">
                Bring your own provider API keys to generate without spending platform credits.
                We validate and encrypt every key before it's stored.
              </p>

              {/* List content */}
              <AddYourKeysList capability={capability} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
