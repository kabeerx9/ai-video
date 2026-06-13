import { SignIn, useAuth } from "@clerk/react";
import { createFileRoute, Navigate } from "@tanstack/react-router";

import { BrandMark } from "@/components/brand-mark";

export const Route = createFileRoute("/")({
  component: AuthPage,
});

function AuthPage() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className="min-h-svh bg-[#f3f0ee]" />;
  }

  if (isSignedIn) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-[#f3f0ee] p-4 md:p-6">
      <div className="pointer-events-none absolute -left-24 top-24 size-80 rounded-full border border-[#f37338]/60 md:size-[34rem]" />
      <div className="pointer-events-none absolute -bottom-48 right-[-10rem] size-[34rem] rounded-full bg-[#e8e2da]" />
      <div className="relative mx-auto grid min-h-[calc(100svh-2rem)] max-w-[1440px] overflow-hidden rounded-[40px] bg-[#fcfbfa] lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative hidden min-h-[760px] flex-col justify-between overflow-hidden bg-[#141413] p-12 text-[#f3f0ee] lg:flex">
          <BrandMark light />
          <div className="relative z-10 max-w-xl">
            <p className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#d1cdc7]">
              <span className="size-2 rounded-full bg-[#f37338]" />
              Your next scene
            </p>
            <h1 className="text-[clamp(3.5rem,6vw,6.6rem)] font-medium leading-[0.92] tracking-[-0.055em]">
              Imagine it.
              <br />
              Watch it move.
            </h1>
            <p className="mt-8 max-w-md text-lg leading-7 text-[#d1cdc7]">
              A focused AI studio for turning a written idea into a finished, downloadable video.
            </p>
          </div>
          <div className="relative h-44">
            <div className="absolute bottom-0 left-0 size-36 rounded-full bg-[#f37338]" />
            <div className="absolute bottom-3 left-28 size-28 rounded-full border border-[#f3f0ee]/50 bg-[#262627]" />
            <div className="absolute bottom-12 left-52 size-16 rounded-full bg-[#f3f0ee]" />
            <svg className="absolute bottom-0 left-0 h-44 w-full" viewBox="0 0 600 180" fill="none">
              <path d="M10 150C170 20 315 30 585 122" stroke="#F37338" strokeWidth="1.5" />
            </svg>
          </div>
        </section>
        <section className="flex min-h-[calc(100svh-2rem)] flex-col px-5 py-6 sm:px-10 lg:px-14">
          <BrandMark className="lg:hidden" />
          <div className="my-auto py-12">
            <div className="mb-8">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#696969]">
                <span className="size-2 rounded-full bg-[#f37338]" />
                Welcome back
              </p>
              <h2 className="text-4xl font-medium tracking-[-0.04em]">Enter your studio</h2>
              <p className="mt-3 text-sm leading-6 text-[#696969]">
                Sign in to create, preview, and download your videos.
              </p>
            </div>
            <SignIn
              routing="path"
              path="/"
              signUpUrl="/sign-up"
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
          </div>
          <p className="text-xs leading-5 text-[#696969]">
            By continuing, you agree to use generated media responsibly.
          </p>
        </section>
      </div>
    </main>
  );
}
