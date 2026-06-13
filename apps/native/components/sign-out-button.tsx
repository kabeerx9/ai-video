import { useClerk } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, TouchableOpacity } from "react-native";

import { colors } from "@/lib/theme";

export const SignOutButton = () => {
  const { signOut } = useClerk();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace("/sign-in");
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
    }
  };

  return (
    <TouchableOpacity
      accessibilityLabel="Sign out"
      style={styles.button}
      onPress={handleSignOut}
    >
      <Ionicons color={colors.ink} name="log-out-outline" size={20} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
});
