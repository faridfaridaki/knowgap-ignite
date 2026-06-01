import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/summary")({
  head: () => ({
    meta: [
      { title: "Session Summary — KnowGap" },
      { name: "description", content: "Summary of your KnowGap learning session." },
    ],
  }),
  component: SummaryScreen,
});

function SummaryScreen() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background px-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Summary coming soon</h1>
        <Link
          to="/"
          className="mt-6 inline-block text-sm text-[#4FC4CF] underline-offset-4 hover:underline"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
