import { useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useGetModel, getGetModelQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

/**
 * Legacy per-tool URL (/tools/:slug). Older links (home tool cards, Presets
 * "Try it", Library "Regenerate") still point here — this now just resolves
 * the model's category and forwards to the category studio page
 * (/image, /video, /audio) with the model preselected via ?model=.
 */
export default function ToolDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();

  const { data: model, isLoading, isError } = useGetModel(slug ?? "", {
    query: { queryKey: getGetModelQueryKey(slug ?? ""), enabled: !!slug },
  });

  useEffect(() => {
    if (model) {
      navigate(`/${model.category}?model=${encodeURIComponent(model.modelId)}`, { replace: true });
    }
  }, [model, navigate]);

  if (!isLoading && (isError || (slug && !model))) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-4">
        <div className="text-6xl font-black text-primary">404</div>
        <h2 className="text-2xl font-bold text-white">Tool not found</h2>
        <p className="text-muted-foreground">This tool doesn't exist or has been removed.</p>
        <Link href="/tools">
          <Button className="bg-primary text-black font-bold hover:bg-primary/90">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Tools
          </Button>
        </Link>
      </div>
    );
  }

  return <div className="min-h-screen" />;
}
