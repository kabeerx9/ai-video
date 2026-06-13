import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandMark } from "@/components/brand-mark";
import { SignOutButton } from "@/components/sign-out-button";
import {
  ApiError,
  downloadGenerationJob,
  generateVideo,
  getGenerationJob,
  getGenerationJobs,
  getGenerationJobVideoSource,
  getMe,
  getVideoModels,
  type GenerationJob,
  type MeResponse,
  type VideoModel,
} from "@/lib/api";
import { colors } from "@/lib/theme";

const GENERATION_CREDIT_COST = 10;
const POLL_INTERVAL_MS = 5_000;
const FALLBACK_ASPECT_RATIOS = ["16:9", "9:16", "1:1"];
const FALLBACK_RESOLUTIONS = ["720p", "1080p"];
const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED", "EXPIRED"]);

type AuthenticatedVideoSource = Awaited<ReturnType<typeof getGenerationJobVideoSource>>;

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();
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
  const [videoSource, setVideoSource] = useState<AuthenticatedVideoSource | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const refreshAccount = useCallback(async () => {
    const profile = await getMe();
    setMe(profile);
  }, []);

  const refreshJobs = useCallback(async () => {
    const response = await getGenerationJobs();
    setJobs(response.jobs);
  }, []);

  const showPreview = useCallback(async (job: GenerationJob) => {
    setError(null);
    setIsLoadingPreview(true);
    try {
      const source = await getGenerationJobVideoSource(job.id);
      setPreviewJob(job);
      setVideoSource(source);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the generated video");
    } finally {
      setIsLoadingPreview(false);
    }
  }, []);

  const pollJob = useCallback(
    async (jobId: string) => {
      try {
        const { job } = await getGenerationJob(jobId);
        setActiveJob(job);
        setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);

        if (job.status === "COMPLETED") {
          stopPolling();
          await Promise.all([showPreview(job), refreshAccount(), refreshJobs()]);
          return;
        }

        if (TERMINAL_STATUSES.has(job.status)) {
          stopPolling();
          setError(job.error ?? "Video generation did not complete");
          await Promise.all([refreshAccount(), refreshJobs()]);
          return;
        }

        pollTimerRef.current = setTimeout(() => {
          void pollJob(jobId);
        }, POLL_INTERVAL_MS);
      } catch (err) {
        stopPolling();
        setError(err instanceof ApiError ? err.message : "Could not check generation status");
      }
    },
    [refreshAccount, refreshJobs, showPreview, stopPolling],
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
    if (!isSignedIn) {
      return;
    }

    let cancelled = false;
    void Promise.all([getMe(), getVideoModels(), getGenerationJobs()])
      .then(([profile, modelResponse, jobsResponse]) => {
        if (cancelled) {
          return;
        }
        setMe(profile);
        setModels(modelResponse.models);
        setJobs(jobsResponse.jobs);
        const firstModel = modelResponse.models[0];
        if (firstModel) {
          setSelectedModel(firstModel.id);
          setAspectRatio(firstModel.supportedAspectRatios[0] ?? "16:9");
          setResolution(firstModel.supportedResolutions[0] ?? "720p");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load your studio");
        }
      });

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [isSignedIn, stopPolling]);

  if (!isLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/sign-in" />;
  }

  const handleModelChange = (model: VideoModel) => {
    setSelectedModel(model.id);
    setAspectRatio(model.supportedAspectRatios[0] ?? "16:9");
    setResolution(model.supportedResolutions[0] ?? "720p");
  };

  const handleGenerate = async () => {
    setError(null);
    setIsSubmitting(true);
    setActiveJob(null);
    setPreviewJob(null);
    setVideoSource(null);

    try {
      const { job } = await generateVideo({
        prompt: prompt.trim(),
        model: selectedModel,
        duration: Number(duration),
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
      setError(err instanceof ApiError ? err.message : "Could not start video generation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (job: GenerationJob) => {
    setDownloadingJobId(job.id);
    setError(null);
    try {
      await downloadGenerationJob(job.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download the video");
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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <BrandMark />
            <View style={styles.headerActions}>
              <View style={styles.creditPill}>
                <Ionicons color={colors.rust} name="sparkles" size={15} />
                <Text style={styles.creditText}>{me?.credits ?? "—"}</Text>
              </View>
              <SignOutButton />
            </View>
          </View>

          <View style={styles.hero}>
            <Eyebrow label="Creative studio" />
            <Text style={styles.heroTitle}>Give your idea{"\n"}somewhere to go.</Text>
            <Text style={styles.heroCopy}>
              Hello, {name}. Describe the scene and we will turn it into a finished video.
            </Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.cardHeading}>
              <View>
                <Text style={styles.cardTitle}>Direct the scene</Text>
                <Text style={styles.cardSubtitle}>One clear prompt works best.</Text>
              </View>
              <View style={styles.iconCircle}>
                <Ionicons color={colors.ink} name="color-wand-outline" size={22} />
              </View>
            </View>

            <FieldLabel label="Prompt" />
            <View style={styles.promptShell}>
              <TextInput
                multiline
                maxLength={4000}
                placeholder="A cinematic tracking shot of a lone cyclist crossing a salt flat at sunrise..."
                placeholderTextColor="#A59F99"
                style={styles.promptInput}
                textAlignVertical="top"
                value={prompt}
                onChangeText={setPrompt}
              />
              <Text style={styles.characterCount}>{prompt.length}/4000</Text>
            </View>

            <FieldLabel label="Model" style={styles.sectionLabel} />
            <ScrollView
              horizontal
              contentContainerStyle={styles.horizontalOptions}
              showsHorizontalScrollIndicator={false}
            >
              {models.map((model) => (
                <OptionPill
                  key={model.id}
                  label={model.name}
                  selected={selectedModel === model.id}
                  onPress={() => handleModelChange(model)}
                />
              ))}
            </ScrollView>

            <FieldLabel label="Duration" style={styles.sectionLabel} />
            <View style={styles.optionWrap}>
              {["4", "6", "8"].map((value) => (
                <OptionPill
                  key={value}
                  label={`${value}s`}
                  selected={duration === value}
                  onPress={() => setDuration(value)}
                />
              ))}
            </View>

            <View style={styles.twoColumn}>
              <View style={styles.column}>
                <FieldLabel label="Frame" style={styles.sectionLabel} />
                <View style={styles.optionWrap}>
                  {aspectRatios.map((value) => (
                    <OptionPill
                      compact
                      key={value}
                      label={value}
                      selected={aspectRatio === value}
                      onPress={() => setAspectRatio(value)}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.column}>
                <FieldLabel label="Quality" style={styles.sectionLabel} />
                <View style={styles.optionWrap}>
                  {resolutions.map((value) => (
                    <OptionPill
                      compact
                      key={value}
                      label={value}
                      selected={resolution === value}
                      onPress={() => setResolution(value)}
                    />
                  ))}
                </View>
              </View>
            </View>

            {selectedModelMeta?.description ? (
              <Text style={styles.modelDescription}>{selectedModelMeta.description}</Text>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              disabled={generationDisabled}
              style={({ pressed }) => [
                styles.generateButton,
                generationDisabled && styles.disabled,
                pressed && styles.pressed,
              ]}
              onPress={() => void handleGenerate()}
            >
              {isSubmitting || isPolling ? (
                <ActivityIndicator color={colors.canvas} size="small" />
              ) : (
                <Ionicons color={colors.canvas} name="sparkles" size={19} />
              )}
              <Text style={styles.generateButtonText}>
                {isSubmitting
                  ? "Starting generation"
                  : isPolling
                    ? "Building your video"
                    : "Generate video"}
              </Text>
              {!isSubmitting && !isPolling ? (
                <Ionicons color={colors.canvas} name="arrow-forward" size={20} />
              ) : null}
            </Pressable>
            <Text style={styles.costText}>
              {GENERATION_CREDIT_COST} credits per generation · {me?.credits ?? "—"} available
            </Text>
          </View>

          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View>
                <Text style={styles.previewTitle}>Preview</Text>
                <Text style={styles.previewSubtitle}>
                  {previewJob ? "Your finished scene" : "Your video will appear here"}
                </Text>
              </View>
              <StatusPill job={activeJob ?? previewJob} loading={isPolling} />
            </View>
            <View style={styles.videoFrame}>
              {videoSource ? (
                <AuthenticatedVideo source={videoSource} />
              ) : (
                <EmptyPreview loading={isPolling || isLoadingPreview} />
              )}
            </View>
            {previewJob ? (
              <Pressable
                style={({ pressed }) => [styles.downloadButton, pressed && styles.pressed]}
                onPress={() => void handleDownload(previewJob)}
              >
                {downloadingJobId === previewJob.id ? (
                  <ActivityIndicator color={colors.ink} size="small" />
                ) : (
                  <Ionicons color={colors.ink} name="download-outline" size={19} />
                )}
                <Text style={styles.downloadText}>Save or share MP4</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.historySection}>
            <Eyebrow label="Recent work" />
            <Text style={styles.historyTitle}>Your latest generations</Text>
            {jobs.length ? (
              jobs.map((job) => (
                <View key={job.id} style={styles.jobCard}>
                  <View style={styles.jobTopRow}>
                    <View style={styles.jobIcon}>
                      <Ionicons color={colors.ink} name="film-outline" size={20} />
                    </View>
                    <StatusPill job={job} />
                  </View>
                  <Text numberOfLines={2} style={styles.jobPrompt}>
                    {job.prompt}
                  </Text>
                  <View style={styles.jobFooter}>
                    <Text style={styles.jobDate}>
                      {new Intl.DateTimeFormat(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(new Date(job.createdAt))}
                    </Text>
                    {job.status === "COMPLETED" ? (
                      <View style={styles.jobActions}>
                        <Pressable
                          accessibilityLabel="Preview video"
                          style={styles.roundActionSecondary}
                          onPress={() => void showPreview(job)}
                        >
                          <Ionicons color={colors.ink} name="play" size={17} />
                        </Pressable>
                        <Pressable
                          accessibilityLabel="Save or share video"
                          style={styles.roundAction}
                          onPress={() => void handleDownload(job)}
                        >
                          {downloadingJobId === job.id ? (
                            <ActivityIndicator color={colors.white} size="small" />
                          ) : (
                            <Ionicons color={colors.white} name="download-outline" size={17} />
                          )}
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyHistoryText}>Your first generation will land here.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AuthenticatedVideo({ source }: { source: AuthenticatedVideoSource }) {
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = true;
  });

  return (
    <VideoView
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
      nativeControls
      player={player}
      style={styles.video}
    />
  );
}

function EmptyPreview({ loading }: { loading: boolean }) {
  return (
    <View style={styles.emptyPreview}>
      <View style={styles.orbitLarge} />
      <View style={styles.orbitSmall} />
      <View style={styles.playCircle}>
        {loading ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <Ionicons color={colors.ink} name="play" size={28} style={styles.playIcon} />
        )}
      </View>
      <Text style={styles.emptyPreviewTitle}>
        {loading ? "Rendering your scene" : "Ready when you are"}
      </Text>
      <Text style={styles.emptyPreviewCopy}>
        {loading
          ? "This can take a few minutes. Keep the app open."
          : "Your finished video will play right here."}
      </Text>
    </View>
  );
}

function Eyebrow({ label }: { label: string }) {
  return (
    <View style={styles.eyebrow}>
      <View style={styles.eyebrowDot} />
      <Text style={styles.eyebrowText}>{label.toUpperCase()}</Text>
    </View>
  );
}

function FieldLabel({ label, style }: { label: string; style?: object }) {
  return <Text style={[styles.fieldLabel, style]}>{label.toUpperCase()}</Text>;
}

function OptionPill({
  label,
  selected,
  compact = false,
  onPress,
}: {
  label: string;
  selected: boolean;
  compact?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.optionPill,
        compact && styles.optionPillCompact,
        selected && styles.optionPillSelected,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Text
        numberOfLines={1}
        style={[styles.optionText, selected && styles.optionTextSelected]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function StatusPill({ job, loading = false }: { job: GenerationJob | null; loading?: boolean }) {
  const status = job?.status ?? "READY";
  const complete = status === "COMPLETED";
  const failed = ["FAILED", "CANCELLED", "EXPIRED"].includes(status);
  return (
    <View
      style={[
        styles.statusPill,
        complete && styles.statusComplete,
        failed && styles.statusFailed,
      ]}
    >
      {loading && !complete && !failed ? (
        <ActivityIndicator color={colors.ink} size={10} />
      ) : (
        <View
          style={[
            styles.statusDot,
            complete && styles.statusDotComplete,
            failed && styles.statusDotFailed,
          ]}
        />
      )}
      <Text
        style={[
          styles.statusText,
          complete && styles.statusTextComplete,
          failed && styles.statusTextFailed,
        ]}
      >
        {loading && !complete && !failed ? "GENERATING" : status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { backgroundColor: colors.canvas, flex: 1 },
  loadingScreen: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    flex: 1,
    justifyContent: "center",
  },
  scrollContent: { paddingBottom: 64, paddingHorizontal: 16 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  headerActions: { alignItems: "center", flexDirection: "row", gap: 8 },
  creditPill: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 22,
    flexDirection: "row",
    gap: 6,
    height: 44,
    paddingHorizontal: 14,
  },
  creditText: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  hero: { paddingBottom: 32, paddingHorizontal: 4, paddingTop: 40 },
  eyebrow: { alignItems: "center", flexDirection: "row", gap: 8 },
  eyebrowDot: { backgroundColor: colors.orange, borderRadius: 4, height: 8, width: 8 },
  eyebrowText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 48,
    fontWeight: "500",
    letterSpacing: -2.4,
    lineHeight: 48,
    marginTop: 16,
  },
  heroCopy: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 20,
    maxWidth: 340,
  },
  formCard: { backgroundColor: colors.lifted, borderRadius: 36, padding: 20 },
  cardHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  cardTitle: { color: colors.ink, fontSize: 18, fontWeight: "700", letterSpacing: -0.4 },
  cardSubtitle: { color: colors.muted, fontSize: 13, marginTop: 4 },
  iconCircle: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 9,
  },
  sectionLabel: { marginTop: 22 },
  promptShell: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 26,
    borderWidth: 1,
    minHeight: 174,
    padding: 16,
  },
  promptInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    lineHeight: 24,
    minHeight: 120,
    padding: 0,
  },
  characterCount: { color: "#8A847E", fontSize: 11, textAlign: "right" },
  horizontalOptions: { gap: 8, paddingRight: 12 },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionPill: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    maxWidth: 240,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  optionPillCompact: { minHeight: 40, paddingHorizontal: 13 },
  optionPillSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  optionText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  optionTextSelected: { color: colors.canvas },
  twoColumn: { flexDirection: "row", gap: 16 },
  column: { flex: 1 },
  modelDescription: {
    backgroundColor: colors.canvas,
    borderRadius: 20,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 22,
    padding: 14,
  },
  error: {
    backgroundColor: colors.dangerSurface,
    borderRadius: 18,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 16,
    padding: 13,
  },
  generateButton: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: 28,
    flexDirection: "row",
    gap: 10,
    height: 56,
    justifyContent: "center",
    marginTop: 24,
    paddingHorizontal: 20,
  },
  generateButtonText: {
    color: colors.canvas,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  costText: { color: colors.muted, fontSize: 11, marginTop: 11, textAlign: "center" },
  previewCard: {
    backgroundColor: colors.ink,
    borderRadius: 36,
    marginTop: 14,
    padding: 20,
  },
  previewHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  previewTitle: { color: colors.lifted, fontSize: 17, fontWeight: "700" },
  previewSubtitle: { color: "#D1CDC7", fontSize: 13, marginTop: 4 },
  videoFrame: {
    aspectRatio: 16 / 11,
    backgroundColor: colors.charcoal,
    borderRadius: 28,
    overflow: "hidden",
  },
  video: { height: "100%", width: "100%" },
  emptyPreview: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    overflow: "hidden",
    padding: 24,
  },
  orbitLarge: {
    borderColor: "rgba(243, 115, 56, 0.55)",
    borderRadius: 120,
    borderWidth: 1,
    height: 240,
    left: -100,
    position: "absolute",
    top: -60,
    width: 240,
  },
  orbitSmall: {
    backgroundColor: colors.orange,
    borderRadius: 90,
    bottom: -90,
    height: 180,
    position: "absolute",
    right: -60,
    width: 180,
  },
  playCircle: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 32,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  playIcon: { marginLeft: 3 },
  emptyPreviewTitle: {
    color: colors.lifted,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.4,
    marginTop: 18,
  },
  emptyPreviewCopy: {
    color: "#D1CDC7",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    maxWidth: 220,
    textAlign: "center",
  },
  downloadButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: colors.white,
    borderRadius: 24,
    flexDirection: "row",
    gap: 8,
    height: 48,
    marginTop: 14,
    paddingHorizontal: 18,
  },
  downloadText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  statusPill: {
    alignItems: "center",
    backgroundColor: colors.orange,
    borderRadius: 18,
    flexDirection: "row",
    gap: 6,
    minHeight: 30,
    paddingHorizontal: 10,
  },
  statusComplete: { backgroundColor: colors.successSurface },
  statusFailed: { backgroundColor: colors.dangerSurface },
  statusDot: { backgroundColor: colors.ink, borderRadius: 3, height: 6, width: 6 },
  statusDotComplete: { backgroundColor: colors.success },
  statusDotFailed: { backgroundColor: colors.danger },
  statusText: { color: colors.ink, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  statusTextComplete: { color: colors.success },
  statusTextFailed: { color: colors.danger },
  historySection: { paddingHorizontal: 4, paddingTop: 48 },
  historyTitle: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: "500",
    letterSpacing: -1.3,
    marginBottom: 20,
    marginTop: 10,
  },
  jobCard: {
    backgroundColor: colors.lifted,
    borderRadius: 28,
    marginBottom: 10,
    minHeight: 190,
    padding: 18,
  },
  jobTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  jobIcon: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: 21,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  jobPrompt: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
    lineHeight: 23,
    marginTop: 24,
  },
  jobFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
  },
  jobDate: { color: colors.muted, fontSize: 11 },
  jobActions: { flexDirection: "row", gap: 8 },
  roundAction: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  roundActionSecondary: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  emptyHistory: {
    alignItems: "center",
    borderColor: "rgba(20, 20, 19, 0.2)",
    borderRadius: 28,
    borderStyle: "dashed",
    borderWidth: 1,
    height: 180,
    justifyContent: "center",
  },
  emptyHistoryText: { color: colors.muted, fontSize: 13 },
});
