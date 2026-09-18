import { useGame } from "@/games/race/store/game";
import { Menu } from "@/games/race/components/game/Menu";
import { Results } from "@/games/race/components/game/Results";
import { GameCanvas } from "@/games/race/components/game/GameCanvas";
import { HUD } from "@/games/race/components/game/HUD";

function GamePage() {
  const phase = useGame((s) => s.phase);

  let screen;
  if (phase === "race") {
    screen = (
      <div className="fixed inset-0 bg-sky">
        <GameCanvas />
        <HUD />
      </div>
    );
  } else if (phase === "result") {
    screen = <Results />;
  } else {
    screen = <Menu />;
  }

  return screen;
}

export default GamePage;
