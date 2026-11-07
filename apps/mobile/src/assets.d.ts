// Lets TypeScript import the bundled PNG artwork; Metro resolves it to an image source at build time.
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';
  const source: ImageSourcePropType;
  export default source;
}
