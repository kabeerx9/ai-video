import { SignUp, useAuth } from "@clerk/react";
import { createFileRoute, Navigate } from "@tanstack/react-router";

import { BrandMark } from "@/components/brand-mark";

export const Route = createFileRoute("/sign-up")({
  component: SignUpPage,
});

function SignUpPage() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className="min-h-svh bg-[#f3f0ee]" />;
  }

  if (isSignedIn) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[#f3f0ee] p-4 md:p-6">
      <div className="pointer-events-none absolute -left-40 top-20 size-[34rem] rounded-full border border-[#f37338]/60" />
      <div className="pointer-events-none absolute -bottom-52 -right-36 size-[38rem] rounded-full bg-[#e8e2da]" />
      <section className="relative z-10 w-full max-w-xl rounded-[40px] bg-[#fcfbfa] p-6 shadow-[0_24px_48px_rgba(0,0,0,0.08)] sm:p-10">
        <BrandMark />
        <div className="mb-8 mt-12">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#696969]">
            <span className="size-2 rounded-full bg-[#f37338]" />
            Start creating
          </p>
          <h1 className="text-4xl font-medium tracking-[-0.04em]">Build your studio</h1>
        </div>
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/"
          fallbackRedirectUrl="/dashboard"
          appearance={{
            variables: {
              colorPrimary: "#141413",
              colorBackground: "#fcfbfa",
              borderRadius: "20px",
            },
            elements: {
              rootBox: "w-full",
              cardBox: "w-full shadow-none",
              card: "w-full bg-transparent p-0 shadow-none",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton:
                "h-12 rounded-full border-[#141413]/15 bg-white text-[#141413]",
              formFieldInput:
                "h-12 rounded-[20px] border-[#141413]/15 bg-white px-4 shadow-none",
              formButtonPrimary:
                "h-12 rounded-full bg-[#141413] text-[#f3f0ee] hover:bg-[#262627]",
              footerActionLink: "text-[#9a3a0a]",
              dividerLine: "bg-[#141413]/10",
            },
          }}
        />
      </section>
    </main>
  );
}
