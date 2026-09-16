import { type RefObject } from "react";
import { findNodeHandle, Share, type View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { ImageFormat, Skia } from "@shopify/react-native-skia";

type ShareOrganismCardInput = {
  cardRef: RefObject<View | null>;
  generation: number;
  organismNumber: string;
};

function waitForFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function formatOrganismNumber(organismNumber: string) {
  return organismNumber.padStart(6, "0");
}

function createShareMessage({ generation, organismNumber }: Omit<ShareOrganismCardInput, "cardRef">) {
  return [
    `Organism #${formatOrganismNumber(organismNumber)} - Generation ${generation}`,
    "Descendant of Seeker Zero.",
    "The species is spreading.",
  ].join("\n");
}

function createShareFileUri(organismNumber: string) {
  const cacheDirectory = FileSystem.cacheDirectory;

  if (!cacheDirectory) {
    throw new Error("Share cache unavailable.");
  }

  const safeOrganismNumber = organismNumber.replace(/[^a-z0-9_-]/gi, "") || "specimen";

  return `${cacheDirectory}spor-organism-${safeOrganismNumber}.png`;
}

async function captureCardImage(cardRef: ShareOrganismCardInput["cardRef"]) {
  await waitForFrame();
  await waitForFrame();

  const nativeTag = findNodeHandle(cardRef.current);

  if (!nativeTag) {
    throw new Error("Share card unavailable.");
  }

  const image = await Skia.Image.MakeImageFromViewTag(nativeTag);

  if (!image) {
    throw new Error("Share image unavailable.");
  }

  const exportImage = image.makeNonTextureImage() ?? image;

  return exportImage.encodeToBase64(ImageFormat.PNG, 100);
}

export async function shareOrganismCard({ cardRef, generation, organismNumber }: ShareOrganismCardInput) {
  const message = createShareMessage({ generation, organismNumber });
  const imageBase64 = await captureCardImage(cardRef);
  const imageUri = createShareFileUri(organismNumber);

  await FileSystem.writeAsStringAsync(imageUri, imageBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const nativeImageSharingAvailable = await Sharing.isAvailableAsync().catch(() => false);

  if (nativeImageSharingAvailable) {
    await Sharing.shareAsync(imageUri, {
      dialogTitle: "Share organism",
      mimeType: "image/png",
      UTI: "public.png",
    });
    return;
  }

  await Share.share({
    message,
    title: "SPOR",
  });
}
