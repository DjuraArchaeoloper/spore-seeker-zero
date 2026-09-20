declare module "*.png" {
  const image: {
    src: string;
    width: number;
    height: number;
    blurDataURL?: string;
  };

  export default image;
}
