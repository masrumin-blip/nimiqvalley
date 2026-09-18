import { createFileRoute } from "@tanstack/react-router";

const title = "About — NimiqValley";
const description = "Learn more about NimiqValley.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: About,
});

function About() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">About</h1>
        <p className="mt-2 text-sm text-muted-foreground">More about NimiqValley is coming soon.</p>
      </div>
    </main>
  );
}
