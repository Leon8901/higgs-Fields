import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-6 border border-primary/30">
        <div className="w-4 h-4 bg-primary rounded-sm shadow-[0_0_15px_rgba(206,255,0,0.8)]" />
      </div>
      <h1 className="text-6xl font-bold text-white mb-4 tracking-tighter">404</h1>
      <p className="text-xl text-muted-foreground mb-8 max-w-md">
        The signal was lost. We couldn't find the page you're looking for in the network.
      </p>
      <Button asChild variant="lime" size="lg">
        <Link href="/">Return to Home</Link>
      </Button>
    </div>
  );
}
