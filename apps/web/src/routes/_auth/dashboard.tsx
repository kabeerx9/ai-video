import { UserButton, useUser } from "@clerk/react";
import { Button } from "@ai-video/ui/components/button";
import { Input } from "@ai-video/ui/components/input";
import { Label } from "@ai-video/ui/components/label";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ApiError,
  fetchGenerationJobVideoBlob,
  generateVideo,
  getGenerationJob,
  getMe,
  getVideoModels,
  type GenerationJob,
  type MeResponse,
  type VideoModel,
} from "@/lib/api";

const POLL_INTERVAL_MS = 20_000;
const GENERATION_CREDIT_COST = 10;

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useUser();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [models, setModels] = useState<VideoModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("4");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("720p");
  const [activeJob, setActiveJob] = useState<GenerationJob | null>(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshMe = useCallback(async () => {
    const profile = await getMe();
    setMe(profile);
    return profile;
  }, []);

  const loadVideoPreview = useCallback(async (jobId: string) => {
    const blob = await fetchGenerationJobVideoBlob(jobId);
    const objectUrl = URL.createObjectURL(blob);
    setVideoBlobUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return objectUrl;
    });
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const pollJob = useCallback(
    async (jobId: string) => {
      try {
        const { job } = await getGenerationJob(jobId);
        setActiveJob(job);

        if (job.status === "COMPLETED") {
          stopPolling();
          await loadVideoPreview(jobId);
          await refreshMe();
          return;
        }

        if (job.status === "FAILED" || job.status === "CANCELLED" || job.status === "EXPIRED") {
          stopPolling();
          setError(job.error ?? "Video generation failed");
          await refreshMe();
        }
      } catch (err) {
        stopPolling();
        setError(err instanceof ApiError ? err.message : "Failed to check generation status");
      }
    },
    [loadVideoPreview, refreshMe, stopPolling],
  );

  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling();
      setIsPolling(true);
      void pollJob(jobId);
      pollTimerRef.current = setInterval(() => {
        void pollJob(jobId);
      }, POLL_INTERVAL_MS);
    },
    [pollJob, stopPolling],
  );

  useEffect(() => {
    void (async () => {
      try {
        await refreshMe();
        const { models: availableModels } = await getVideoModels();
        setModels(availableModels);
        if (availableModels[0]) {
          setSelectedModel(availableModels[0].id);
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load dashboard");
      }
    })();
  }, [refreshMe]);

  useEffect(() => {
    return () => {
      stopPolling();
      if (videoBlobUrl) {
        URL.revokeObjectURL(videoBlobUrl);
      }
    };
  }, [stopPolling, videoBlobUrl]);

  const handleGenerate = async () => {
    setError(null);
    setIsSubmitting(true);
    setActiveJob(null);
    setVideoBlobUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });

    try {
      const { job } = await generateVideo({
        prompt,
        model: selectedModel,
        duration: Number(duration) || undefined,
        aspectRatio,
        resolution,
      });

      setActiveJob(job);
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

  const name =
    user?.fullName ||
    user?.firstName ||
    user?.primaryEmailAddress?.emailAddress ||
    "there";

  const selectedModelMeta = models.find((model) => model.id === selectedModel);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">AI Video</h1>
        <UserButton />
      </div>
      <p className="text-muted-foreground">Welcome, {name}</p>

      <div className="rounded-lg border p-6">
        <p className="text-sm text-muted-foreground">Available credits</p>
        <p className="text-3xl font-semibold">{me?.credits ?? "—"}</p>
        <p className="mt-2 text-sm text-muted-foreground">{GENERATION_CREDIT_COST} credits per generation</p>
      </div>

      <div className="rounded-lg border p-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <select
            id="model"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedModel}
            onChange={(event) => setSelectedModel(event.target.value)}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          {selectedModelMeta?.description ? (
            <p className="text-sm text-muted-foreground">{selectedModelMeta.description}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt">Prompt</Label>
          <textarea
            id="prompt"
            className="flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="A cinematic shot of a golden retriever running on a beach at sunset"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (s)</Label>
            <Input
              id="duration"
              type="number"
              min={1}
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="aspectRatio">Aspect ratio</Label>
            <Input
              id="aspectRatio"
              value={aspectRatio}
              onChange={(event) => setAspectRatio(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resolution">Resolution</Label>
            <Input
              id="resolution"
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
            />
          </div>
        </div>

        <Button
          className="w-full"
          disabled={isSubmitting || isPolling || !prompt.trim() || !selectedModel}
          onClick={() => void handleGenerate()}
        >
          {isSubmitting ? "Starting..." : isPolling ? "Generating..." : "Generate video"}
        </Button>

        {activeJob ? (
          <p className="text-sm text-muted-foreground">
            Job status: <span className="font-medium text-foreground">{activeJob.status}</span>
          </p>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      {videoBlobUrl ? (
        <div className="rounded-lg border p-4">
          <p className="mb-3 text-sm text-muted-foreground">Generated video (temporary preview)</p>
          <video className="w-full rounded-md" controls src={videoBlobUrl} />
        </div>
      ) : null}
    </div>
  );
}
