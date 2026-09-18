import kaelImage from "@/assets/kael-arvand.jpg";
import elvarImage from "@/assets/empu-elvar.jpg";
import lumiImage from "@/assets/lumi-aster.jpg";
import miraImage from "@/assets/mira-floren.jpg";
import nimiImage from "@/assets/nimi-queen.jpg";

export type Character = {
  id: string;
  name: string;
  role: string;
  trait: string;
  greeting: string;
  replies: string[];
  image: string;
};

export const CHARACTERS: Character[] = [
  { id: "nimi", name: "Nimi Queen", role: "Queen", trait: "Graceful, clever, and commanding", greeting: "Welcome back. What story would you like to share today?", replies: ["The valley always listens to those who arrive with an open heart.", "The mist is not an enemy. It is simply waiting for someone brave enough to ask.", "Walk slowly. Good answers rarely arrive in a hurry."], image: nimiImage },
  { id: "kael", name: "Kael Arvand", role: "Explorer", trait: "Brave, easygoing, and loyal", greeting: "You finally made it! Shall we explore, or trade stories first?", replies: ["The best maps sometimes begin with a path no one has tried.", "I know a secret route, but we need to leave before sunset.", "Do not worry. I will not let you walk alone."], image: kaelImage },
  { id: "lumi", name: "Lumi Aster", role: "Nimiq Valley Villager", trait: "Gentle, imaginative, and empathetic", greeting: "Hello... the wind carried a little dream. Perhaps it belongs to you?", replies: ["Tell me slowly. Even a small light is enough to guide us.", "That dream is not gone. It is only searching for its way home.", "I am here. We can sit together until the sky feels lighter."], image: lumiImage },
  { id: "mira", name: "Mira Floren", role: "Nimiq Valley Villager", trait: "Friendly, optimistic, and helpful", greeting: "Hello! Take a seat. What would you like to share today?", replies: ["Sometimes a difficult day is simply asking us to pause for a moment.", "I have flower tea and plenty of time to listen.", "We can untangle it one piece at a time, like arranging flower stems."], image: miraImage },
  { id: "elvar", name: "Empu Elvar", role: "Village Elder", trait: "Wise, thoughtful, and mysterious", greeting: "Come in, child. The fire is calm; this is a good time for stories.", replies: ["Answers grow for those who patiently tend their questions.", "The forest keeps the tracks, but people choose the direction.", "Sit close to the fire. Good advice should never be rushed."], image: elvarImage },
];

export function getCharacter(id: string) {
  return CHARACTERS.find((character) => character.id === id);
}
