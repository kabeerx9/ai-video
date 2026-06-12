import { useAuth, useUser } from "@clerk/expo";
import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { SignOutButton } from "@/components/sign-out-button";

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

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
