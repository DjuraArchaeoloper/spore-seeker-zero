import { Linking } from "react-native";
import {
  SPORE_LEGAL_URLS,
  type SporeLegalDocument,
} from "@spore/shared";

export async function openSporeLegalDocument(document: SporeLegalDocument) {
  try {
    await Linking.openURL(SPORE_LEGAL_URLS[document]);
  } catch (error) {
    console.warn(
      "[SPØR LEGAL] Unable to open legal document.",
      error instanceof Error ? error.message : "Unknown legal link error.",
    );
  }
}
