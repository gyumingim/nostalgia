"use client"

import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import * as THREE from 'three';
import PanelItem from '@/components/PanelItem'

const DEFAULT_IMAGE_SOURCES = [
  '1.webp', '2.webp', '3.webp', '4.webp', '5.webp', '6.webp',
  '7.webp', '8.webp', '9.webp', '10.webp', '11.webp', '12.webp',
  '13.webp', '14.webp', '15.webp', '16.webp',
];

export default function ThreeJsCarousel() {
  // UI state for customization
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [backgroundAlpha, setBackgroundAlpha] = useState(0);
  const [cameraZ, setCameraZ] = useState(800);
  const [spacing, setSpacing] = useState(20);
  const [rotationSpeed, setRotationSpeed] = useState(0.015);
  const [captureFrames, setCaptureFrames] = useState(600);
  const [rotationDirection, setRotationDirection] = useState<'clockwise' | 'counterclockwise'>('clockwise');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const capturingRef = useRef(false);
  const frameCounterRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      1,
      2000
    );
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
    containerRef.current.appendChild(renderer.domElement);

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    const planeSize = 325;
    const count = DEFAULT_IMAGE_SOURCES.length;
    const minRadius = (planeSize / 2) / Math.sin(Math.PI / count);
    const radius = Math.max(500, minRadius + spacing);

    const group = new THREE.Group();
    const loader = new THREE.TextureLoader();
    DEFAULT_IMAGE_SOURCES.forEach((src, idx) => {
      loader.load(src, texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide,
          transparent: true,
        });
        const geometry = new THREE.PlaneGeometry(planeSize, planeSize);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.scale.x = -1;
        const angle = (idx / count) * Math.PI * 2;
        mesh.position.set(
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius
        );
        mesh.lookAt(0, 0, 0);
        group.add(mesh);
      });
    });
    scene.add(group);

    let frameId: number;
    const dirMult = rotationDirection === 'clockwise' ? 1 : -1;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      group.rotation.y += rotationSpeed * dirMult;
      renderer.render(scene, camera);
      if (capturingRef.current) {
        frameCounterRef.current += 1;
        if (frameCounterRef.current >= captureFrames) {
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
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [backgroundColor, backgroundAlpha, cameraZ, spacing, rotationSpeed, captureFrames, rotationDirection]);

  // Start WebM capture
  const startCapture = () => {
    if (capturingRef.current || !containerRef.current) return;
    capturingRef.current = true;
    frameCounterRef.current = 0;
    const canvas = containerRef.current.querySelector('canvas');
    if (!canvas) return;
    const stream = canvas.captureStream(60);
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 10_000_000, audioBitsPerSecond: 128_000, bitsPerSecond: 10_128_000 });
    chunksRef.current = [];
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
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
      <Head>
        <title>Three.js Carousel - Customizable</title>
      </Head>

      {/* Control Panel */}
      <div className="fixed top-0 left-0 w-full bg-white border flex flex-row items-center z-[9999]">
        <PanelItem label="BG Color">
          <input
            type="color"
            value={backgroundColor}
            onChange={e => setBackgroundColor(e.target.value)}
            className="w-6 h-6 p-0 m-0"
          />
        </PanelItem>

        <PanelItem label="Alpha">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={backgroundAlpha}
            onChange={e => setBackgroundAlpha(parseFloat(e.target.value))}
            className="w-24"
          />
        </PanelItem>

        <PanelItem label="Camera Z">
          <input
            type="number"
            value={cameraZ}
            onChange={e => setCameraZ(parseInt(e.target.value, 10))}
            className="w-16"
          />
        </PanelItem>

        <PanelItem label="Spacing">
          <input
            type="number"
            value={spacing}
            onChange={e => setSpacing(parseInt(e.target.value, 10))}
            className="w-16"
          />
        </PanelItem>

        <PanelItem label="Speed">
          <input
            type="number"
            step={0.001}
            value={rotationSpeed}
            onChange={e => setRotationSpeed(parseFloat(e.target.value))}
            className="w-20"
          />
        </PanelItem>

        <PanelItem label="Frames">
          <input
            type="number"
            value={captureFrames}
            onChange={e => setCaptureFrames(parseInt(e.target.value, 10))}
            className="w-16"
          />
        </PanelItem>

        {/* <PanelItem label="Direction">
          <select
            value={rotationDirection}
            onChange={e => setRotationDirection(e.target.value as 'clockwise' | 'counterclockwise')}
            className="w-32"
          >
            <option value="clockwise">Clockwise</option>
            <option value="counterclockwise">Counterclockwise</option>
          </select>
        </PanelItem> */}

        <PanelItem>
          <button
            onClick={startCapture}
            className="px-4 hover:bg-gray-100 hover:text-black bg-black text-white absolute right-0 "
          >
            {captureFrames} Frame Capture
          </button>
        </PanelItem>
      </div>

      <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />
    </>
  );
};

