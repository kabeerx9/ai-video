import { useSignIn } from "@clerk/expo";
import { type Href, Link, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AuthShell } from "@/components/auth-shell";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { colors } from "@/lib/theme";
import { formatClerkAuthError } from "@/utils/clerk-errors";

function pushDecoratedUrl(
  router: ReturnType<typeof useRouter>,
  decorateUrl: (url: string) => string,
  href: string,
) {
  const url = decorateUrl(href);
  const nextHref = url.startsWith("http") ? new URL(url).pathname : url;
  router.push(nextHref as Href);
}

export default function Page() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  const emailCodeFactor = signIn.supportedSecondFactors.find(
    (factor) => factor.strategy === "email_code",
  );
  const requiresEmailCode =
    signIn.status === "needs_client_trust" ||
    (signIn.status === "needs_second_factor" && !!emailCodeFactor);

  const handleSubmit = async () => {
    setStatusMessage(null);

    try {
      const { error } = await signIn.password({
        emailAddress: emailAddress.trim(),
        password,
      });

      if (error) {
        setStatusMessage(formatClerkAuthError(error, "Unable to sign in. Please try again."));
        return;
      }

      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: ({ session, decorateUrl }) => {
            if (session?.currentTask) {
              setStatusMessage("Your account needs one more security step.");
              return;
            }

            pushDecoratedUrl(router, decorateUrl, "/");
          },
        });
      } else if (
        signIn.status === "needs_second_factor" ||
        signIn.status === "needs_client_trust"
      ) {
        if (emailCodeFactor) {
          const { error: verificationError } = await signIn.mfa.sendEmailCode();
          if (verificationError) {
            setStatusMessage(
              formatClerkAuthError(verificationError, "Unable to send a verification code."),
            );
            return;
          }
          setStatusMessage(`We sent a verification code to ${emailCodeFactor.safeIdentifier}.`);
        } else {
          setStatusMessage(
            "A second factor is required, but this screen only supports email codes right now.",
          );
        }
      } else {
        setStatusMessage("Sign-in could not be completed. Please try again.");
      }
    } catch (error) {
      setStatusMessage(formatClerkAuthError(error, "Unable to sign in. Please try again."));
    }
  };

  const handleVerify = async () => {
    setStatusMessage(null);

    try {
      const { error } = await signIn.mfa.verifyEmailCode({ code: code.trim() });

      if (error) {
        setStatusMessage(formatClerkAuthError(error, "That verification code is not valid."));
        return;
      }

      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: ({ session, decorateUrl }) => {
            if (session?.currentTask) {
              setStatusMessage("Your account needs one more security step.");
              return;
            }

            pushDecoratedUrl(router, decorateUrl, "/");
          },
        });
      } else {
        setStatusMessage("That code did not complete sign-in. Please try again.");
      }
    } catch (error) {
      setStatusMessage(formatClerkAuthError(error, "That verification code is not valid."));
    }
  };

  if (requiresEmailCode) {
    return (
      <AuthShell
        eyebrow="One last step"
        title="Check your inbox."
        subtitle="Enter the security code Clerk sent to your email address."
      >
        {statusMessage && <Text style={styles.helper}>{statusMessage}</Text>}
        <TextInput
          style={styles.input}
          value={code}
          placeholder="Enter your verification code"
          placeholderTextColor="#666666"
          onChangeText={(value) => setCode(value)}
          keyboardType="numeric"
        />
        {errors.fields.code && <Text style={styles.error}>{errors.fields.code.message}</Text>}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            fetchStatus === "fetching" && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleVerify}
          disabled={fetchStatus === "fetching"}
        >
          <Text style={styles.buttonText}>Verify</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          onPress={() => signIn.mfa.sendEmailCode()}
        >
          <Text style={styles.secondaryButtonText}>I need a new code</Text>
        </Pressable>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Enter your studio."
      subtitle="Sign in to create, preview, and save your generated videos."
    >
      {statusMessage && <Text style={styles.helper}>{statusMessage}</Text>}
      <GoogleSignInButton />
      <Text style={styles.divider}>or</Text>
      <Text style={styles.label}>Email address</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        value={emailAddress}
        placeholder="Enter email"
        placeholderTextColor="#666666"
        onChangeText={(value) => setEmailAddress(value)}
        keyboardType="email-address"
      />
      {errors.fields.identifier && (
        <Text style={styles.error}>{errors.fields.identifier.message}</Text>
      )}
      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        value={password}
        placeholder="Enter password"
        placeholderTextColor="#666666"
        secureTextEntry={true}
        onChangeText={(value) => setPassword(value)}
      />
      {errors.fields.password && <Text style={styles.error}>{errors.fields.password.message}</Text>}
      <Pressable
        style={({ pressed }) => [
          styles.button,
          (!emailAddress || !password || fetchStatus === "fetching") && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
        onPress={handleSubmit}
        disabled={!emailAddress || !password || fetchStatus === "fetching"}
      >
        <Text style={styles.buttonText}>Sign in</Text>
      </Pressable>
      <View style={styles.linkContainer}>
        <Text style={styles.linkPrompt}>Don't have an account? </Text>
        <Link href="/sign-up">
          <Text style={styles.linkText}>Sign up</Text>
        </Link>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 7,
    marginTop: 16,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    minHeight: 50,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  button: {
    backgroundColor: colors.ink,
    minHeight: 50,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.canvas,
    fontWeight: "700",
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryButtonText: {
    color: colors.rust,
    fontWeight: "700",
  },
  linkContainer: {
    flexDirection: "row",
    gap: 4,
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  linkPrompt: { color: colors.muted, fontSize: 13 },
  linkText: {
    color: colors.rust,
    fontWeight: "700",
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 6,
  },
  helper: {
    backgroundColor: colors.canvas,
    borderRadius: 18,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
    padding: 12,
  },
  divider: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 12,
    marginVertical: 16,
  },
});
