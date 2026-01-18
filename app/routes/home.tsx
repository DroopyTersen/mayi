import { useState } from "react";
import { Form, redirect } from "react-router";
import { BookOpen } from "lucide-react";
import type { Route } from "./+types/home";
import { generateRoomId } from "../../core/room/room-id.utils";
import { Button } from "~/shadcn/components/ui/button";
import { Input } from "~/shadcn/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/shadcn/components/ui/card";
import { HouseRulesDrawer } from "~/ui/house-rules/HouseRulesDrawer";

export function meta() {
  return [{ title: "May I?" }];
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    return redirect(`/game/${generateRoomId()}`);
  }

  if (intent === "join") {
    const roomId = formData.get("roomId");
    if (roomId && typeof roomId === "string") {
      return redirect(`/game/${roomId}`);
    }
  }
  return null;
}

export default function Home() {
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl">May I?</CardTitle>
          <CardDescription>Create or join a game room</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Form method="post">
            <input type="hidden" name="intent" value="create" />
            <Button type="submit" size="lg" className="w-full">
              Create New Game
            </Button>
          </Form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Form method="post" className="flex gap-2">
            <input type="hidden" name="intent" value="join" />
            <Input type="text" name="roomId" placeholder="Room ID" />
            <Button type="submit" variant="secondary">
              Join
            </Button>
          </Form>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setRulesOpen(true)}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            View House Rules
          </Button>
          <HouseRulesDrawer open={rulesOpen} onOpenChange={setRulesOpen} />
        </CardContent>
      </Card>
    </main>
  );
}
