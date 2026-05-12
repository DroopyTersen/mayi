import { useState, useCallback, useEffect } from "react";
import { Check, Copy, Hash, Link, Share2 } from "lucide-react";
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

export function canUseNativeShare(
  navigatorLike: Pick<Navigator, "share"> | undefined
): boolean {
  return typeof navigatorLike?.share === "function";
}

export function ShareLinkCard({
  roomId,
  shareUrl,
  className,
}: ShareLinkCardProps) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);

  // Use provided URL or construct from roomId
  const url = shareUrl ?? `/game/${roomId}`;

  useEffect(() => {
    setCanNativeShare(
      canUseNativeShare(typeof navigator === "undefined" ? undefined : navigator)
    );
  }, []);

  const copyText = useCallback(
    async (text: string, copiedType: "link" | "code") => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(copiedType);
        setTimeout(() => setCopied(null), 2000);
      } catch {
        if (typeof document === "undefined") return;

        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
        setCopied(copiedType);
        setTimeout(() => setCopied(null), 2000);
      }
    },
    []
  );

  const handleCopyLink = useCallback(() => copyText(url, "link"), [copyText, url]);
  const handleCopyCode = useCallback(
    () => copyText(roomId, "code"),
    [copyText, roomId]
  );

  const handleNativeShare = useCallback(async () => {
    if (!canNativeShare) return;

    try {
      await navigator.share({
        title: "May I game",
        text: `Join my May I game with room code ${roomId}`,
        url,
      });
    } catch {
      // Share cancellation does not need to surface in the lobby.
    }
  }, [canNativeShare, roomId, url]);

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Link className="w-5 h-5 text-primary" />
          Share Game Link
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          Send this link to friends to invite them to the game.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            data-share-link-input
            value={url}
            readOnly
            className="font-mono text-xs bg-muted min-w-0"
          />
          <Button
            variant={copied === "link" ? "secondary" : "default"}
            onClick={handleCopyLink}
            className="shrink-0"
          >
            {copied === "link" ? (
              <>
                <Check className="w-4 h-4 mr-1" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1" />
                Copy Link
              </>
            )}
          </Button>
        </div>
        <div className="flex flex-col gap-2 mt-3 pt-3 border-t sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 min-w-0">
            <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground shrink-0">
              Room Code:
            </span>
            <code className="bg-muted px-2 py-0.5 rounded font-mono text-sm font-medium">
              {roomId}
            </code>
          </div>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button
              variant={copied === "code" ? "secondary" : "outline"}
              onClick={handleCopyCode}
              size="sm"
            >
              {copied === "code" ? (
                <Check className="w-4 h-4 mr-1" />
              ) : (
                <Copy className="w-4 h-4 mr-1" />
              )}
              {copied === "code" ? "Copied!" : "Copy Code"}
            </Button>
            {canNativeShare && (
              <Button variant="outline" onClick={handleNativeShare} size="sm">
                <Share2 className="w-4 h-4 mr-1" />
                Share Link
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
