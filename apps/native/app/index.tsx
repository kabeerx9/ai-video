import { useAuth, useUser } from "@clerk/expo";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { SignOutButton } from "@/components/sign-out-button";
import { ApiError, getMe, type MeResponse } from "@/lib/api";

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }

    getMe()
      .then(setMe)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Failed to load account");
      });
  }, [isSignedIn]);

  if (!isLoaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/sign-in" />;
  }

  const name = user?.fullName || user?.firstName || "there";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Video</Text>
      <Text style={styles.subtitle}>Welcome, {name}</Text>
      <View style={styles.creditsCard}>
        <Text style={styles.creditsLabel}>Available credits</Text>
        <Text style={styles.creditsValue}>{me?.credits ?? "—"}</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Your video generation workspace — coming soon.</Text>
      </View>
      <SignOutButton />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  creditsCard: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  creditsLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  creditsValue: {
    fontSize: 28,
    fontWeight: "700",
  },
  errorText: {
    marginTop: 8,
    color: "#dc2626",
    fontSize: 14,
  },
  placeholder: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  placeholderText: {
    textAlign: "center",
    opacity: 0.6,
  },
});
