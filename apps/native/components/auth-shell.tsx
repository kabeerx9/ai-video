import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandMark } from "@/components/brand-mark";
import { colors } from "@/lib/theme";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BrandMark />
          <View style={styles.hero}>
            <View style={styles.eyebrow}>
              <View style={styles.dot} />
              <Text style={styles.eyebrowText}>{eyebrow.toUpperCase()}</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <View style={styles.card}>{children}</View>
          <Text style={styles.legal}>Create responsibly. Your generated media stays in your account.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={styles.orbit} />
      <View style={styles.orangeCircle} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { backgroundColor: colors.canvas, flex: 1, overflow: "hidden" },
  content: { padding: 20, paddingBottom: 48 },
  hero: { paddingBottom: 28, paddingTop: 48 },
  eyebrow: { alignItems: "center", flexDirection: "row", gap: 8 },
  dot: { backgroundColor: colors.orange, borderRadius: 4, height: 8, width: 8 },
  eyebrowText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: {
    color: colors.ink,
    fontSize: 46,
    fontWeight: "500",
    letterSpacing: -2,
    lineHeight: 47,
    marginTop: 14,
  },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 14, maxWidth: 330 },
  card: {
    backgroundColor: colors.lifted,
    borderRadius: 34,
    padding: 20,
    position: "relative",
    zIndex: 2,
  },
  legal: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 18, textAlign: "center" },
  orbit: {
    borderColor: "rgba(243, 115, 56, 0.45)",
    borderRadius: 170,
    borderWidth: 1,
    height: 340,
    left: -210,
    position: "absolute",
    top: 180,
    width: 340,
  },
  orangeCircle: {
    backgroundColor: colors.whisper,
    borderRadius: 150,
    bottom: -180,
    height: 300,
    position: "absolute",
    right: -150,
    width: 300,
  },
});
