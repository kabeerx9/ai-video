import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/lib/theme";

export function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <View style={styles.container}>
      <View style={styles.mark}>
        <View style={[styles.circle, styles.inkCircle, light && styles.lightCircle]} />
        <View style={[styles.circle, styles.orangeCircle, light && styles.orangeLightCircle]} />
      </View>
      <Text style={[styles.text, light && styles.lightText]}>AI Video</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  mark: {
    height: 30,
    width: 40,
  },
  circle: {
    borderRadius: 15,
    height: 30,
    position: "absolute",
    top: 0,
    width: 30,
  },
  inkCircle: {
    backgroundColor: colors.ink,
    left: 0,
  },
  orangeCircle: {
    backgroundColor: colors.orange,
    borderColor: colors.ink,
    borderWidth: 1.5,
    right: 0,
  },
  lightCircle: {
    backgroundColor: colors.lifted,
  },
  orangeLightCircle: {
    borderColor: colors.lifted,
  },
  text: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  lightText: {
    color: colors.lifted,
  },
});
