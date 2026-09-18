import { useEffect } from "react";
import { useGame } from "@/games/race/store/game";
import { NetProvider } from "@/games/race/net/NetContext";
import { Menu } from "@/games/race/components/game/Menu";
import { Lobby } from "@/games/race/components/game/Lobby";
import { Results } from "@/games/race/components/game/Results";
import { GameCanvas } from "@/games/race/components/game/GameCanvas";
import { HUD } from "@/games/race/components/game/HUD";
import { roomCodeFromUrl } from "@/games/race/lib/room";

const title = "Nimiq Car Race — 3D Online Racing Game";
const description =
  "Race in a low-poly 3D world, challenge competitive bots, or play online with friends using a room code.";


function GamePage() {
  const phase = useGame((s) => s.phase);
  const mode = useGame((s) => s.mode);
  const roomCode = useGame((s) => s.roomCode);
  const name = useGame((s) => s.name);
  const colorId = useGame((s) => s.colorId);
  const openLobby = useGame((s) => s.openLobby);

  useEffect(() => {
    const code = roomCodeFromUrl();
    if (code && code.length === 4) openLobby(code);
  }, [openLobby]);

  let screen;
  if (phase === "race") {
    screen = (
      <div className="fixed inset-0 bg-sky">
        <GameCanvas />
        <HUD />
      </div>
    );
  } else if (phase === "lobby") {
    screen = <Lobby />;
  } else if (phase === "result") {
    screen = <Results />;
  } else {
    screen = <Menu />;
  }

  if (mode === "online" && roomCode) {
    return (
      <NetProvider roomCode={roomCode} name={name} color={colorId}>
        {screen}
      </NetProvider>
    );
  }
  return screen;
}

export default GamePage;
