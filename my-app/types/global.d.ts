declare global {
  interface Window {
    Image: new () => HTMLImageElement;
  }
}

export {}; 