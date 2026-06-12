import { env } from "@ai-video/env/native";
import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

const LIGHT_THEME = {
  ...DefaultTheme,
  colors: NAV_THEME.light,
};
const DARK_THEME = {
  ...DarkTheme,
  colors: NAV_THEME.dark,
};

export const unstable_settings = {
  initialRouteName: "(drawer)",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default function RootLayout() {
  const { isDarkColorScheme } = useColorScheme();

  return (
    <>
      <ClerkProvider tokenCache={tokenCache} publishableKey={env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}>
        <ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
          <StatusBar style={isDarkColorScheme ? "light" : "dark"} />
          <GestureHandlerRootView style={styles.container}>
            <Stack>
              <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ title: "Modal", presentation: "modal" }} />
            </Stack>
          </GestureHandlerRootView>
        </ThemeProvider>
      </ClerkProvider>
    </>
  );
}
