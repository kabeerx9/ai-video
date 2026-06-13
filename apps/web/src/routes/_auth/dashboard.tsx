import { Button } from "@ai-video/ui/components/button";
import { UserButton, useUser } from "@clerk/react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Film,
  LoaderCircle,
  Play,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BrandMark } from "@/components/brand-mark";
import {
  ApiError,
  fetchGenerationJobVideoBlob,
  generateVideo,
  getGenerationJob,
  getGenerationJobs,
  getMe,
  getVideoModels,
  type GenerationJob,
  type MeResponse,
  type VideoModel,
} from "@/lib/api";

const POLL_INTERVAL_MS = 5_000;
const GENERATION_CREDIT_COST = 10;
const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED", "EXPIRED"]);
const FALLBACK_ASPECT_RATIOS = ["16:9", "9:16", "1:1"];
const FALLBACK_RESOLUTIONS = ["720p", "1080p"];

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useUser();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [models, setModels] = useState<VideoModel[]>([]);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("4");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("720p");
  const [activeJob, setActiveJob] = useState<GenerationJob | null>(null);
  const [previewJob, setPreviewJob] = useState<GenerationJob | null>(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const selectedModelMeta = useMemo(
    () => models.find((model) => model.id === selectedModel),
    [models, selectedModel],
  );
  const aspectRatios =
    selectedModelMeta?.supportedAspectRatios.length
      ? selectedModelMeta.supportedAspectRatios
      : FALLBACK_ASPECT_RATIOS;
  const resolutions =
    selectedModelMeta?.supportedResolutions.length
      ? selectedModelMeta.supportedResolutions
      : FALLBACK_RESOLUTIONS;

  const replacePreviewUrl = useCallback((nextUrl: string | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = nextUrl;
    setVideoBlobUrl(nextUrl);
  }, []);

  const refreshMe = useCallback(async () => {
    const profile = await getMe();
    setMe(profile);
    return profile;
  }, []);

  const refreshJobs = useCallback(async () => {
    const { jobs: recentJobs } = await getGenerationJobs();
    setJobs(recentJobs);
    return recentJobs;
  }, []);

  const loadVideoPreview = useCallback(
    async (job: GenerationJob) => {
      setIsLoadingPreview(true);
      setError(null);
      try {
        const blob = await fetchGenerationJobVideoBlob(job.id);
        replacePreviewUrl(URL.createObjectURL(blob));
        setPreviewJob(job);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load the generated video");
      } finally {
        setIsLoadingPreview(false);
      }
    },
    [replacePreviewUrl],
  );

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const pollJob = useCallback(
    async (jobId: string) => {
      try {
        const { job } = await getGenerationJob(jobId);
        setActiveJob(job);
        setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);

        if (job.status === "COMPLETED") {
          stopPolling();
          await Promise.all([loadVideoPreview(job), refreshMe(), refreshJobs()]);
          return;
        }

        if (TERMINAL_STATUSES.has(job.status)) {
          stopPolling();
          setError(job.error ?? "Video generation did not complete");
          await Promise.all([refreshMe(), refreshJobs()]);
          return;
        }

        pollTimerRef.current = setTimeout(() => {
          void pollJob(jobId);
        }, POLL_INTERVAL_MS);
      } catch (err) {
        stopPolling();
        setError(err instanceof ApiError ? err.message : "Failed to check generation status");
      }
    },
    [loadVideoPreview, refreshJobs, refreshMe, stopPolling],
  );

  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling();
      setIsPolling(true);
      void pollJob(jobId);
    },
    [pollJob, stopPolling],
  );

  useEffect(() => {
    let cancelled = false;

    void Promise.all([refreshMe(), getVideoModels(), refreshJobs()])
      .then(([, modelResponse]) => {
        if (cancelled) {
          return;
        }
        setModels(modelResponse.models);
        const firstModel = modelResponse.models[0];
        if (firstModel) {
          setSelectedModel(firstModel.id);
          setAspectRatio(firstModel.supportedAspectRatios[0] ?? "16:9");
          setResolution(firstModel.supportedResolutions[0] ?? "720p");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load the studio");
        }
      });

    return () => {
      cancelled = true;
      stopPolling();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, [refreshJobs, refreshMe, stopPolling]);

  const handleModelChange = (modelId: string) => {
    const model = models.find((item) => item.id === modelId);
    setSelectedModel(modelId);
    setAspectRatio(model?.supportedAspectRatios[0] ?? "16:9");
    setResolution(model?.supportedResolutions[0] ?? "720p");
  };

  const handleGenerate = async () => {
    setError(null);
    setIsSubmitting(true);
    setActiveJob(null);
    setPreviewJob(null);
    replacePreviewUrl(null);

    try {
      const { job } = await generateVideo({
        prompt: prompt.trim(),
        model: selectedModel,
        duration: Number(duration) || undefined,
        aspectRatio,
        resolution,
      });

      setActiveJob(job);
      setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      setMe((current) =>
        current ? { ...current, credits: current.credits - GENERATION_CREDIT_COST } : current,
      );
      startPolling(job.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start generation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (job: GenerationJob) => {
    setDownloadingJobId(job.id);
    setError(null);
    try {
      const blob =
        previewJob?.id === job.id && videoBlobUrl
          ? await fetch(videoBlobUrl).then((response) => response.blob())
          : await fetchGenerationJobVideoBlob(job.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ai-video-${job.id}.mp4`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to download the video");
    } finally {
      setDownloadingJobId(null);
    }
  };

  const name =
    user?.firstName ||
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "Creator";
  const generationDisabled =
    isSubmitting ||
    isPolling ||
    !prompt.trim() ||
    !selectedModel ||
    (me?.credits ?? 0) < GENERATION_CREDIT_COST;

  return (
    <main className="min-h-svh bg-[#f3f0ee] px-3 py-3 text-[#141413] sm:px-5 sm:py-5">
      <header className="sticky top-3 z-30 mx-auto flex max-w-[1480px] items-center justify-between rounded-full border border-[#141413]/5 bg-white/90 px-4 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.04)] backdrop-blur-xl sm:px-6">
        <BrandMark />
        <div className="hidden items-center gap-2 rounded-full bg-[#f3f0ee] px-4 py-2 text-sm text-[#696969] sm:flex">
          <Sparkles className="size-4 text-[#cf4500]" />
          <span>
            <strong className="font-semibold text-[#141413]">{me?.credits ?? "—"}</strong> credits
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-[#696969] md:inline">Hello, {name}</span>
          <UserButton
            appearance={{
              elements: { avatarBox: "size-10 border-2 border-white shadow-sm" },
            }}
          />
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] pb-20 pt-8 sm:pt-12">
        <section className="mb-8 grid gap-8 px-2 lg:grid-cols-[1fr_auto] lg:items-end lg:px-4">
          <div>
            <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#696969]">
              <span className="size-2 rounded-full bg-[#f37338]" />
              Creative studio
            </p>
            <h1 className="max-w-3xl text-[clamp(2.8rem,7vw,6.8rem)] font-medium leading-[0.9] tracking-[-0.06em]">
              Give your idea
              <br />
              somewhere to go.
            </h1>
          </div>
          <p className="max-w-sm text-base leading-7 text-[#696969] lg:pb-2">
            Describe the scene, choose the frame, and let the studio turn your prompt into a
            downloadable video.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,1.08fr)]">
          <div className="rounded-[40px] bg-[#fcfbfa] p-5 sm:p-8">
            <div className="mb-8 flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">Direct the scene</p>
                <p className="mt-1 text-sm text-[#696969]">One clear prompt works best.</p>
              </div>
              <div className="flex size-12 items-center justify-center rounded-full bg-[#f3f0ee]">
                <WandSparkles className="size-5" />
              </div>
            </div>

            <label htmlFor="prompt" className="mb-2 block text-xs font-bold uppercase tracking-[0.1em]">
              Prompt
            </label>
            <div className="rounded-[28px] border border-[#141413]/10 bg-white p-2 transition focus-within:border-[#141413]/40">
              <textarea
                id="prompt"
                className="min-h-40 w-full resize-none bg-transparent px-4 py-3 text-lg leading-7 outline-none placeholder:text-[#a59f99]"
                placeholder="A cinematic tracking shot of a lone cyclist crossing a salt flat at sunrise..."
                value={prompt}
                maxLength={4000}
                onChange={(event) => setPrompt(event.target.value)}
              />
              <div className="flex items-center justify-between px-3 pb-2 text-xs text-[#8a847e]">
                <span>Be specific about motion, light, and camera.</span>
                <span>{prompt.length}/4000</span>
              </div>
            </div>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <StudioSelect
                label="Model"
                value={selectedModel}
                onChange={handleModelChange}
                options={models.map((model) => ({ value: model.id, label: model.name }))}
              />
              <StudioSelect
                label="Duration"
                value={duration}
                onChange={setDuration}
                options={["4", "6", "8"].map((value) => ({
                  value,
                  label: `${value} seconds`,
                }))}
              />
              <StudioSelect
                label="Aspect ratio"
                value={aspectRatio}
                onChange={setAspectRatio}
                options={aspectRatios.map((value) => ({ value, label: value }))}
              />
              <StudioSelect
                label="Resolution"
                value={resolution}
                onChange={setResolution}
                options={resolutions.map((value) => ({ value, label: value }))}
              />
            </div>

            {selectedModelMeta?.description ? (
              <p className="mt-5 rounded-[20px] bg-[#f3f0ee] px-4 py-3 text-sm leading-6 text-[#696969]">
                {selectedModelMeta.description}
              </p>
            ) : null}

            {error ? (
              <p className="mt-5 rounded-[20px] bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            ) : null}

            <Button
              className="mt-7 h-14 w-full rounded-full bg-[#141413] px-6 text-base text-[#f3f0ee] hover:bg-[#262627]"
              disabled={generationDisabled}
              onClick={() => void handleGenerate()}
            >
              {isSubmitting || isPolling ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : (
                <Sparkles className="size-5" />
              )}
              {isSubmitting
                ? "Starting generation"
                : isPolling
                  ? "Building your video"
                  : "Generate video"}
              {!isSubmitting && !isPolling ? <ArrowRight className="ml-auto size-5" /> : null}
            </Button>
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[#696969]">
              <span>{GENERATION_CREDIT_COST} credits per generation</span>
              <span>•</span>
              <span>{me?.credits ?? "—"} available</span>
            </div>
          </div>

          <div className="relative min-h-[520px] overflow-hidden rounded-[40px] bg-[#141413] p-5 text-[#f3f0ee] sm:min-h-[650px] sm:p-8">
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Preview</p>
                <p className="mt-1 text-sm text-[#d1cdc7]">
                  {previewJob ? "Your finished scene" : "Your video will appear here"}
                </p>
              </div>
              <StatusPill job={activeJob ?? previewJob} isPolling={isPolling} />
            </div>

            <div className="absolute inset-x-5 bottom-5 top-24 overflow-hidden rounded-[32px] bg-[#262627] sm:inset-x-8 sm:bottom-8">
              {videoBlobUrl ? (
                <>
                  <video
                    className="h-full w-full object-contain"
                    controls
                    playsInline
                    src={videoBlobUrl}
                  />
                  {previewJob ? (
                    <Button
                      className="absolute bottom-4 right-4 h-12 rounded-full border border-white/20 bg-white px-5 text-sm text-[#141413] hover:bg-[#f3f0ee]"
                      onClick={() => void handleDownload(previewJob)}
                    >
                      {downloadingJobId === previewJob.id ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <ArrowDownToLine className="size-4" />
                      )}
                      Download MP4
                    </Button>
                  ) : null}
                </>
              ) : (
                <EmptyPreview isLoading={isPolling || isLoadingPreview} />
              )}
            </div>
          </div>
        </section>

        <section className="mt-16 px-2 lg:px-4">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#696969]">
                <span className="size-2 rounded-full bg-[#f37338]" />
                Recent work
              </p>
              <h2 className="text-3xl font-medium tracking-[-0.04em] sm:text-4xl">
                Your latest generations
              </h2>
            </div>
            <div className="hidden text-sm text-[#696969] sm:block">{jobs.length} saved jobs</div>
          </div>

          {jobs.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {jobs.map((job) => (
                <article
                  key={job.id}
                  className="group flex min-h-56 flex-col justify-between rounded-[32px] bg-[#fcfbfa] p-5 transition-transform hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#f3f0ee]">
                      <Film className="size-5" />
                    </div>
                    <StatusPill job={job} />
                  </div>
                  <div className="mt-8">
                    <p className="line-clamp-2 text-lg font-medium leading-6 tracking-[-0.02em]">
                      {job.prompt}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="flex min-w-0 items-center gap-2 text-xs text-[#696969]">
                        <Clock3 className="size-3.5" />
                        <span className="truncate">
                          {new Intl.DateTimeFormat(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          }).format(new Date(job.createdAt))}
                        </span>
                      </p>
                      {job.status === "COMPLETED" ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="flex size-10 items-center justify-center rounded-full border border-[#141413]/15 bg-white transition hover:bg-[#141413] hover:text-white"
                            aria-label="Preview video"
                            onClick={() => void loadVideoPreview(job)}
                          >
                            <Play className="size-4 fill-current" />
                          </button>
                          <button
                            type="button"
                            className="flex size-10 items-center justify-center rounded-full bg-[#141413] text-white transition hover:bg-[#262627]"
                            aria-label="Download video"
                            onClick={() => void handleDownload(job)}
                          >
                            {downloadingJobId === job.id ? (
                              <LoaderCircle className="size-4 animate-spin" />
                            ) : (
                              <ArrowDownToLine className="size-4" />
                            )}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex min-h-56 items-center justify-center rounded-[40px] border border-dashed border-[#141413]/20">
              <p className="text-sm text-[#696969]">Your first generation will land here.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StudioSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.1em]">{label}</span>
      <span className="relative block">
        <select
          className="h-12 w-full appearance-none rounded-full border border-[#141413]/10 bg-white px-4 pr-10 text-sm outline-none transition focus:border-[#141413]/40"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2" />
      </span>
    </label>
  );
}

function StatusPill({
  job,
  isPolling = false,
}: {
  job: GenerationJob | null;
  isPolling?: boolean;
}) {
  const status = job?.status ?? "READY";
  const isComplete = status === "COMPLETED";
  const isFailed = ["FAILED", "CANCELLED", "EXPIRED"].includes(status);
  const label = isPolling && !isComplete && !isFailed ? "GENERATING" : status;

  return (
    <span
      className={[
        "inline-flex h-8 items-center gap-2 rounded-full px-3 text-[10px] font-bold tracking-[0.1em]",
        isComplete
          ? "bg-emerald-100 text-emerald-800"
          : isFailed
            ? "bg-red-100 text-red-700"
            : status === "READY"
              ? "bg-white/10 text-[#d1cdc7]"
              : "bg-[#f37338] text-[#141413]",
      ].join(" ")}
    >
      {isComplete ? (
        <Check className="size-3.5" />
      ) : isPolling ? (
        <LoaderCircle className="size-3.5 animate-spin" />
      ) : (
        <span className="size-1.5 rounded-full bg-current" />
      )}
      {label}
    </span>
  );
}

function EmptyPreview({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden">
      <div className="absolute left-[-12%] top-[18%] size-64 rounded-full border border-[#f37338]/50 sm:size-80" />
      <div className="absolute bottom-[-18%] right-[-8%] size-64 rounded-full bg-[#f37338] sm:size-80" />
      <div className="absolute bottom-[18%] right-[26%] size-32 rounded-full border border-white/20 bg-[#141413] sm:size-40" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 700" fill="none">
        <path d="M-40 540C155 168 470 82 848 368" stroke="#F37338" strokeWidth="1.5" />
      </svg>
      <div className="relative z-10 flex max-w-xs flex-col items-center text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-white text-[#141413]">
          {isLoading ? (
            <LoaderCircle className="size-7 animate-spin" />
          ) : (
            <Play className="ml-1 size-7 fill-current" />
          )}
        </div>
        <p className="mt-6 text-xl font-medium tracking-[-0.03em]">
          {isLoading ? "Rendering your scene" : "Ready when you are"}
        </p>
        <p className="mt-2 text-sm leading-6 text-[#d1cdc7]">
          {isLoading
            ? "This can take a few minutes. You can keep this tab open."
            : "Add a prompt and your finished video will play right here."}
        </p>
      </div>
    </div>
  );
}
