"use client"

import { useEffect, useRef, useState, DragEvent } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import * as THREE from 'three';
import PanelItem from '@/components/PanelItem';

const ALLOWED_TYPE = 'image/webp';
const REQUIRED_WIDTH = 1000;
const REQUIRED_HEIGHT = 1000;

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

  // Refs for Three.js and file input
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const capturingRef = useRef(false);
  const frameCounterRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Common image processing
  const processFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (file.type !== ALLOWED_TYPE) {
        alert('Only .webp files are allowed.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result as string;
        const img = new Image();
        img.onload = () => {
          if (img.width === REQUIRED_WIDTH && img.height === REQUIRED_HEIGHT) {
            setImages((prev) => [...prev, src]);
          } else {
            alert(`Image must be ${REQUIRED_WIDTH}×${REQUIRED_HEIGHT}px.`);
          }
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
  };

  // Drag & drop handlers
  const onDragOver = (e: DragEvent) => e.preventDefault();
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    processFiles(e.dataTransfer.files);
  };

  // File input change handler
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = '';
  };

  const removeImage = (idx: number) => setImages((prev) => prev.filter((_, i) => i !== idx));

  // Three.js carousel setup
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.z = cameraZ;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true,
      outputColorSpace: THREE.SRGBColorSpace,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(backgroundColor, backgroundAlpha);
    container.appendChild(renderer.domElement);

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    const planeSize = 325;
    const count = images.length;
    const radius = Math.max(500, (count > 0 ? (planeSize / 2) / Math.sin(Math.PI / count) : 500) + spacing);

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
    const frameLimit = Math.ceil((2 * Math.PI) / rotationSpeed);

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
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      scene.clear();
      container.removeChild(renderer.domElement);
    };
  }, [images, backgroundColor, backgroundAlpha, cameraZ, spacing, rotationSpeed, rotationDirection]);

  // Start WebM capture
  const startCapture = () => {
    const container = containerRef.current;
    if (capturingRef.current || !container) return;
    capturingRef.current = true;
    frameCounterRef.current = 0;
    const canvas = container.querySelector('canvas');
    if (!canvas) return;
    const stream = canvas.captureStream(60);
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 10_000_000 });
    chunksRef.current = [];
    mediaRecorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'capture.webm'; a.click(); URL.revokeObjectURL(url);
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
            <input type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} className="w-6 h-6 p-0 m-0" />
          </PanelItem>
          <PanelItem label="Alpha">
            <input type="range" min={0} max={1} step={0.01} value={backgroundAlpha} onChange={e => setBackgroundAlpha(parseFloat(e.target.value))} className="w-24" />
          </PanelItem>
          <PanelItem label="Camera Z">
            <input type="number" value={cameraZ} onChange={e => setCameraZ(parseInt(e.target.value, 10))} className="w-16" />
          </PanelItem>
          <PanelItem label="Spacing">
            <input type="number" value={spacing} onChange={e => setSpacing(parseInt(e.target.value, 10))} className="w-16" />
          </PanelItem>
          <PanelItem label="Speed">
            <input type="number" step={0.001} value={rotationSpeed} onChange={e => setRotationSpeed(parseFloat(e.target.value))} className="w-20" />
          </PanelItem>
          <PanelItem>
            <button onClick={startCapture} className="px-4 hover:bg-gray-100 hover:text-black bg-black text-white">
              Capture One Revolution
            </button>
          </PanelItem>
        </div>
      </div>

      <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />
    </>
  );
}
