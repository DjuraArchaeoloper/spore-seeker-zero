import { StyleSheet, View } from "react-native";

import { AppText } from "../components/AppText";
import { PrimaryButton } from "../components/PrimaryButton";
import { tokens } from "../design/tokens";

type AuthEntryScreenProps = {
  status: "restoring" | "unauthenticated" | "authenticating";
  error?: string | null;
  onEnter: () => void;
};

export function AuthEntryScreen({ error, onEnter, status }: AuthEntryScreenProps) {
  const disabled = status !== "unauthenticated";
  const label = status === "authenticating" ? "VERIFYING" : status === "restoring" ? "RESTORING" : "ENTER SPORE";

  return (
    <View style={styles.screen}>
      <View style={styles.copy}>
        <AppText variant="display">SPORE</AppText>
        <AppText tone="secondary" variant="body">
          SEEKER ZERO
        </AppText>
        <AppText style={styles.supporting}>THE FIRST SEEKERBORNE CASE.</AppText>
      </View>

      <View style={styles.action}>
        {error ? (
          <AppText tone="muted" variant="metadata">
            {error}
          </AppText>
        ) : null}
        <PrimaryButton disabled={disabled} label={label} onPress={onEnter} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  supporting: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    opacity: 0.64,
  },
  screen: {
    backgroundColor: tokens.colors.background,
    flex: 1,
    justifyContent: "space-between",
    paddingBottom: tokens.spacing.xxl,
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.xxxl
  },
  copy: {
    gap: tokens.spacing.md,
    paddingTop: tokens.spacing.xxxl
  },
  action: {
    gap: tokens.spacing.md
  }
});
