import { UserButton, useUser } from "@clerk/react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useUser();
  const name =
    user?.fullName ||
    user?.firstName ||
    user?.primaryEmailAddress?.emailAddress ||
    "there";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">AI Video</h1>
        <UserButton />
      </div>
      <p className="text-muted-foreground">Welcome, {name}</p>
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Your video generation workspace — coming soon.
      </div>
    </div>
  );
}
