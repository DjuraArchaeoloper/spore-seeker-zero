import { StyleSheet, View } from "react-native";

import { tokens } from "../design/tokens";
import { AppText } from "./AppText";

type StatRowProps = {
  label: string;
  value: string;
  detail?: string;
};

export function StatRow({ detail, label, value }: StatRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <AppText tone="muted" variant="metadata">
          {label}
        </AppText>
        {detail ? (
          <AppText tone="secondary" variant="body">
            {detail}
          </AppText>
        ) : null}
      </View>
      <AppText variant="display">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    backgroundColor: tokens.colors.surfaceSubtle,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.md,
    borderWidth: tokens.border.width,
    flexDirection: "row",
    gap: tokens.spacing.lg,
    justifyContent: "space-between",
    minHeight: 96,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md
  },
  copy: {
    flex: 1,
    gap: tokens.spacing.xs
  }
});
