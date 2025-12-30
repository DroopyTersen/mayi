import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/shadcn/components/ui/card";
import { Button } from "~/shadcn/components/ui/button";
import { Input } from "~/shadcn/components/ui/input";
import { cn } from "~/shadcn/lib/utils";

interface ShareLinkCardProps {
  roomId: string;
  shareUrl?: string;
  className?: string;
}

export function ShareLinkCard({
  roomId,
  shareUrl,
  className,
}: ShareLinkCardProps) {
  const [copied, setCopied] = useState(false);

  // Use provided URL or construct from roomId
  const url = shareUrl ?? `/game/${roomId}`;

  const handleCopy = useCallback(async () => {
    try {
      // Try clipboard API first
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the input for manual copy
      const input = document.querySelector<HTMLInputElement>(
        '[data-share-link-input]'
      );
      if (input) {
        input.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }, [url]);

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <svg
            className="w-5 h-5 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          Share Game Link
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          Send this link to friends to invite them to the game.
        </p>
        <div className="flex gap-2">
          <Input
            data-share-link-input
            value={url}
            readOnly
            className="font-mono text-xs bg-muted min-w-0"
          />
          <Button
            variant={copied ? "secondary" : "default"}
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? (
              <>
                <svg
                  className="w-4 h-4 mr-1"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-1"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy
              </>
            )}
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
          <span className="text-sm text-muted-foreground">Room ID:</span>
          <code className="bg-muted px-2 py-0.5 rounded font-mono text-sm font-medium">
            {roomId}
          </code>
        </div>
      </CardContent>
    </Card>
  );
}
