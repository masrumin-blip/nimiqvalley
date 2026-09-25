import { Coins } from "lucide-react";

import { KeyShopDialog } from "@/components/KeyShopDialog";
import { Button } from "@/components/ui/button";
import { useCredits } from "@/hooks/useCredits";
import { totalChatsLeft } from "@/lib/credits";

/** Shows the remaining AI messages; opens the shop on the AI chat tab. */
export function ChatCredits() {
  const { credits } = useCredits();
  const left = totalChatsLeft(credits);

  return (
    <KeyShopDialog
      initialTab="chat"
      trigger={
        <Button
          size="sm"
          variant={left === 0 ? "default" : "secondary"}
          className="min-h-11 shrink-0 rounded-full px-3 text-[11px] font-bold"
        >
          <Coins className="size-3.5" />
          {left} left
        </Button>
      }
    />
  );
}
