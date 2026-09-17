declare module "opentype.js" {
  export type Path = {
    toPathData(decimalPlaces?: number): string;
  };

  export type Glyph = {
    advanceWidth?: number;
    getPath(x: number, y: number, fontSize: number): Path;
    name?: string;
    unicode?: number;
  };

  export type Font = {
    charToGlyph(character: string): Glyph;
    unitsPerEm: number;
  };

  export function parse(buffer: ArrayBuffer): Font;
}
