import { ClientOnly } from "@tanstack/react-router";
import CarromGame from "@/games/carrom/components/CarromGame";


function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-background p-2">
      <h1 className="sr-only">Carronimiq</h1>
      <ClientOnly fallback={<p className="text-muted-foreground">Loading board…</p>}>
        <CarromGame />
      </ClientOnly>
    </main>
  );
}

export default Index;
