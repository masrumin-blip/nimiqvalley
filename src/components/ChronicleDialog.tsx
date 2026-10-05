import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ch1 from "@/assets/chronicle-1.jpg";
import ch2 from "@/assets/chronicle-2.jpg";
import ch3 from "@/assets/chronicle-3.jpg";
import ch4 from "@/assets/chronicle-4.jpg";

const CHAPTERS = [
  {
    no: "I",
    title: "The Genesis Ray",
    era: "2017 – 2018",
    img: ch1,
    text: [
      "Long ago, coins lived in distant fortresses that only miners and machines could reach. Then a small band of builders raised a light anyone could hold: a blockchain that ran right inside the web browser.",
      "No downloads, no gatekeepers. In 2018 the Nimiq mainnet awoke, and every villager with a browser could become part of the network.",
    ],
  },
  {
    no: "II",
    title: "The Great Oasis",
    era: "2019 – 2022",
    img: ch2,
    text: [
      "Kingdoms of old money and the free valleys of crypto stood apart, divided by deep water. The builders dreamed of a bridge.",
      "Through OASIS and Fastspot, atomic swaps let travelers cross between NIM, Bitcoin and everyday currencies without handing their coins to a middleman.",
    ],
  },
  {
    no: "III",
    title: "The Era of Flight",
    era: "2024",
    img: ch3,
    text: [
      "The old proof-of-work mines were loud and hungry. So the network grew wings: Albatross, a proof-of-stake chain built for speed and calm.",
      "Blocks now arrive in moments, energy use fell away, and villagers can stake their NIM to help keep the valley safe.",
    ],
  },
  {
    no: "IV",
    title: "The Rise of Nimiq Pay",
    era: "Today",
    img: ch4,
    text: [
      "At last the coin reached the market stalls. With Nimiq Pay, a villager can pay a merchant, top up, and open mini apps straight from their phone.",
      "And NimiqValley itself is one of those homes, a village where the hexagon is passed from hand to hand. The legend continues with you.",
    ],
  },
];

export default function ChronicleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [i, setI] = useState(0);
  const c = CHAPTERS[i]!;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto p-0">
        <img src={c.img} alt={`Chapter ${c.no}: ${c.title}`} className="aspect-[4/3] w-full rounded-t-lg object-cover [image-rendering:pixelated]" />
        <div className="space-y-3 p-5">
          <DialogHeader>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Chapter {c.no} · {c.era}</p>
            <DialogTitle className="text-xl">{c.title}</DialogTitle>
            <DialogDescription className="sr-only">The Nimiq Chronicle, chapter {c.no}</DialogDescription>
          </DialogHeader>
          {c.text.map((t) => (
            <p key={t} className="text-sm leading-relaxed text-muted-foreground">{t}</p>
          ))}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</Button>
            <div className="flex gap-1.5">
              {CHAPTERS.map((ch, k) => (
                <button key={ch.no} aria-label={`Chapter ${ch.no}`} onClick={() => setI(k)} className={`size-2.5 rounded-full ${k === i ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
            {i < CHAPTERS.length - 1 ? (
              <Button size="sm" onClick={() => setI(i + 1)}>Next</Button>
            ) : (
              <Button size="sm" onClick={() => { onOpenChange(false); setI(0); }}>Close</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
