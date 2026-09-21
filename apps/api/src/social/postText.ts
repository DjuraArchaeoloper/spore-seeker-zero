export const MAX_POST_TEXT_LENGTH = 280;

export class PostTextError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function parsePostText(value: unknown) {
  if (typeof value !== "string") {
    throw new PostTextError("text must be a string.");
  }

  const text = value.trim();

  if (!text) {
    throw new PostTextError("text is required.");
  }

  if (text.length > MAX_POST_TEXT_LENGTH) {
    throw new PostTextError(`text must be at most ${MAX_POST_TEXT_LENGTH} characters.`);
  }

  return text;
}
