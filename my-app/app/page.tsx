"use client"

import { useEffect, useRef, useState, DragEvent } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import * as THREE from 'three';
import PanelItem from '@/components/PanelItem';

interface DataTransferItem {
  kind: string;
  type: string;
  getAsFile(): File | null;
}

interface HTMLImageElement extends HTMLElement {
  onload: () => void;
  naturalWidth: number;
  naturalHeight: number;
  src: string;
}

interface HTMLAnchorElement extends HTMLElement {
  href: string;
  download: string;
  click(): void;
}

interface HTMLCanvasElement extends HTMLElement {
  captureStream(frameRate?: number): MediaStream;
  parentNode: Node | null;
  domElement: HTMLCanvasElement;
}

interface NodeList {
  [index: number]: Node;
  length: number;
  item(index: number): Node | null;
}

interface Node {
  parentNode: Node | null;
  childNodes: NodeList;
  nodeType: number;
  nodeName: string;
}

interface HTMLElement extends Node {
  style?: CSSStyleDeclaration;
  classList?: DOMTokenList;
}

interface MediaRecorderType {
  start(): void;
  stop(): void;
  ondataavailable: (event: MediaRecorderDataAvailableEvent) => void;
  onstop: () => void;
}

interface CSSStyleDeclaration {
  cssText: string;
  length: number;
  getPropertyValue(property: string): string;
  setProperty(property: string, value: string): void;
}

interface DOMTokenList {
  add(...tokens: string[]): void;
  remove(...tokens: string[]): void;
  contains(token: string): boolean;
  toggle(token: string): boolean;
}

declare global {
  const window: Window & typeof globalThis;
  const document: Document;
  interface Window {
    MediaRecorder: {
      new(stream: MediaStream, options?: MediaRecorderOptions): MediaRecorderType;
    };
    alert(message: string): void;
    innerWidth: number;
    innerHeight: number;
    devicePixelRatio: number;
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  }
  interface DataTransfer {
    items: DataTransferItem[];
  }
  interface HTMLInputElement extends HTMLElement {
    files: FileList | null;
    value: string;
    click(): void;
  }
  interface HTMLDivElement extends HTMLElement {
    querySelector(selectors: string): HTMLCanvasElement | null;
    clientWidth: number;
    clientHeight: number;
    contains(node: Node): boolean;
    appendChild(node: Node): Node;
    removeChild(node: Node): Node;
  }
  interface Document {
    createElement(tagName: "img"): HTMLImageElement;
    createElement(tagName: "a"): HTMLAnchorElement;
    createElement(tagName: string): HTMLElement;
  }
  interface Node {
    parentNode: Node | null;
  }
  const alert: (message: string) => void;
}

const ALLOWED_TYPE = 'image/webp';
const REQUIRED_WIDTH = 1000;
const REQUIRED_HEIGHT = 1000;
// 클라이언트 사이드에서만 사용되는 유틸리티 함수
const isClient = typeof window !== 'undefined' && window !== null;
const getWindow = (): Window | null => (typeof window !== 'undefined' ? window : null);
const getDocument = (): Document | null => (typeof document !== 'undefined' ? document : null);

export default function ThreeJsCarousel() {
  // UI state for customization
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [backgroundAlpha, setBackgroundAlpha] = useState(0);
  const [cameraZ, setCameraZ] = useState(800);
  const [spacing, setSpacing] = useState(20);
  const [rotationSpeed, setRotationSpeed] = useState(0.015);
  const [rotationDirection] = useState<'clockwise' | 'counterclockwise'>('clockwise');

  // Dynamic images state
  const [images, setImages] = useState<string[]>([]);
  // Capture status for UI  
  const [isCapturing, setIsCapturing] = useState(false);

  // Refs for Three.js and file input
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const capturingRef = useRef(false);
  const frameCounterRef = useRef(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mediaRecorderRef = useRef<any>(null);
  const chunksRef = useRef<Blob[]>([]);

  // 이미지 처리 함수
  const processImage = (src: string) => {
    if (!isClient) return;
    const doc = getDocument();
    if (!doc) return;
    
    const img = doc.createElement('img');
    img.onload = () => {
      if (img.naturalWidth === REQUIRED_WIDTH && img.naturalHeight === REQUIRED_HEIGHT) {
        setImages((prev) => [...prev, src]);
      } else {
        window.alert(`Image must be ${REQUIRED_WIDTH}×${REQUIRED_HEIGHT}px.`);
      }
    };
    img.src = src;
  };

  // Common image processing
  const processFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (file.type !== ALLOWED_TYPE) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result as string;
        processImage(src);
      };
      reader.readAsDataURL(file);
    });
  };

  // Drag & drop handlers
  const onDragOver = (e: DragEvent<HTMLDivElement>) => e.preventDefault();
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = e.dataTransfer?.items ? Array.from(e.dataTransfer.items)
      .filter((item: DataTransferItem) => item.kind === 'file')
      .map((item: DataTransferItem) => item.getAsFile())
      .filter((file): file is File => file !== null)
      : [];
    processFiles(files);
  };

  // File input change handler
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = '';
  };

  const removeImage = (idx: number) => setImages((prev) => prev.filter((_, i) => i !== idx));

  // Three.js carousel setup
  useEffect(() => {
    if (!isClient) return;
    
    const container = containerRef.current as HTMLDivElement;
    if (!container) return;

    const scene = new THREE.Scene();
    const win = getWindow();
    if (!win) return;
    
    const width = container.clientWidth || win.innerWidth;
    const height = container.clientHeight || win.innerHeight;
    const camera = new THREE.PerspectiveCamera(70, width / height, 1, 2000);
    camera.position.z = cameraZ;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(win.devicePixelRatio || 1);
    renderer.setClearColor(backgroundColor, backgroundAlpha);
    container.appendChild(renderer.domElement as unknown as Node);

    const onResize = () => {
      const newWidth = container.clientWidth || win.innerWidth;
      const newHeight = container.clientHeight || win.innerHeight;
      renderer.setSize(newWidth, newHeight);
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
    };
    win.addEventListener('resize', onResize);

    const planeSize = 325;
    const count = images.length;
    const defaultRadius = count > 0 ? (planeSize / 2) / Math.sin(Math.PI / count) : 500;
    const radius = defaultRadius + spacing; // allow negative spacing

    const group = new THREE.Group();
    const loader = new THREE.TextureLoader();
    images.forEach((src, idx) => {
      loader.load(src, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeSize, planeSize), material);
        mesh.scale.x = -1;
        const angle = (idx / count) * Math.PI * 2;
        mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        mesh.lookAt(0, 0, 0);
        group.add(mesh);
      });
    });
    scene.add(group);

    let frameId: number;
    const dirMult = rotationDirection === 'clockwise' ? 1 : -1;
    const frameLimit = Math.ceil((2 * Math.PI) / rotationSpeed) * 1.2;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      group.rotation.y += rotationSpeed * dirMult;
      renderer.render(scene, camera);
      if (capturingRef.current) {
        frameCounterRef.current += 1;
        if (frameCounterRef.current >= frameLimit) {
          capturingRef.current = false;
          mediaRecorderRef.current?.stop();
        }
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      win.removeEventListener('resize', onResize);
      renderer.dispose();
      scene.clear();
      if (container.contains(renderer.domElement as unknown as Node)) {
        container.removeChild(renderer.domElement as unknown as Node);
      }
    };
  }, [images, backgroundColor, backgroundAlpha, cameraZ, spacing, rotationSpeed, rotationDirection]);

  // Start WebM capture
  const startCapture = async () => {
    if (!isClient) return;
    
    const container = containerRef.current;
    if (capturingRef.current || !container) return;
    
    const win = getWindow();
    const doc = getDocument();
    if (!win || !doc) return;
    
    capturingRef.current = true;
    setIsCapturing(true);
    frameCounterRef.current = 0;
    const canvas = container.querySelector('canvas');
    if (!canvas) return;
    const stream = canvas.captureStream(60);
    const mediaRecorder = new win.MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 10_000_000 });
    chunksRef.current = [];
    mediaRecorder.ondataavailable = (e: MediaRecorderDataAvailableEvent) => e.data.size > 0 && chunksRef.current.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = doc.createElement('a');
      a.href = url;
      a.download = 'capture.webm';
      a.click();
      URL.revokeObjectURL(url);
      setIsCapturing(false);
    };
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
  };

  return (
    <>
      <Head><title>Three.js Carousel - Customizable</title></Head>

      {/* Control Panel */}
      <div className="fixed top-0 left-0 w-full bg-white border z-[9999] flex flex-col">
        {/* File Manager Header */}
        <div className="flex items-center p-2 space-x-4 border-b">
          <input ref={fileInputRef} type="file" accept="image/webp" multiple onChange={onFileChange} className="hidden" />
          <PanelItem label="Upload">
            <div
              onDragOver={onDragOver}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 border-2 border-dashed flex items-center justify-center text-center text-sm cursor-pointer"
            >
              Drop or Click<br/>.webp <br/>(1000×1000)
            </div>
          </PanelItem>
          <PanelItem label="Images">
            <div className="flex space-x-2 overflow-x-auto p-1">
              {images.map((src, idx) => (
                <div key={idx} className="relative w-12 h-12">
                  <Image src={src} alt={`img-${idx}`} width={48} height={48} className="object-cover" unoptimized />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-0 right-0 bg-red-600 text-white rounded-full w-4 h-4 text-xs"
                  >×</button>
                </div>
              ))}
            </div>
          </PanelItem>
        </div>
        {/* Main Controls Header */}
        <div className="flex items-center p-2 space-x-4">
          <PanelItem label="BG Color">
            <input type="color" defaultValue={backgroundColor} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBackgroundColor(e.target.value)} className="w-6 h-6 p-0 m-0" />
          </PanelItem>
          <PanelItem label="Alpha">
            <input type="range" min={0} max={1} step={0.01} defaultValue={backgroundAlpha} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBackgroundAlpha(parseFloat(e.target.value))} className="w-24" />
          </PanelItem>
          <PanelItem label="Camera Z">
            <input type="number" defaultValue={cameraZ} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCameraZ(parseInt(e.target.value, 10))} className="w-16" />
          </PanelItem>
          <PanelItem label="Spacing">
            <input type="number" defaultValue={spacing} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSpacing(parseInt(e.target.value, 10))} className="w-16" />
          </PanelItem>
          <PanelItem label="Speed">
            <input type="number" step={0.001} defaultValue={rotationSpeed} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRotationSpeed(parseFloat(e.target.value))} className="w-20" />
          </PanelItem>
          <PanelItem>
            <button
              onClick={startCapture}
              disabled={isCapturing}
              className={`px-4 ${isCapturing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 hover:text-black'} bg-black text-white`}>
              {isCapturing ? 'Capturing...' : 'Capture One Revolution'}
            </button>
          </PanelItem>
        </div>
      </div>

      <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />
    </>
  );
}

