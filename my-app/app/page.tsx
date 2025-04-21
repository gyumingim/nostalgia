'use client';

import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import * as THREE from 'three';

const MAX_CAPTURES = 600;
const IMAGE_SOURCES = [
  '1.webp', '2.webp', '3.webp', '4.webp', '5.webp', '6.webp',
  '7.webp', '8.webp', '9.webp', '10.webp', '11.webp', '12.webp',
  '13.webp', '14.webp', '15.webp', '16.webp',
];

export default function ThreeJsCarousel() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const capturingRef = useRef(false);
  const frameCounterRef = useRef(0);
  const mediaRecorderRef = useRef<any | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = null; // ✅ 투명 배경

    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      1,
      2000
    );
    camera.position.z = 800;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true,
      outputColorSpace: THREE.SRGBColorSpace,
    });
    renderer.setClearColor(0x000000, 0); // ✅ 투명 배경
    containerRef.current.appendChild(renderer.domElement);

    const applyRendererSize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    applyRendererSize();
    window.addEventListener('resize', applyRendererSize);

    const planeSize = 325;
    const count = IMAGE_SOURCES.length;
    const minRadius = (planeSize / 2) / Math.sin(Math.PI / count);
    const radius = Math.max(500, minRadius + 20);

    const group = new THREE.Group();
    const loader = new THREE.TextureLoader();

    IMAGE_SOURCES.forEach((src, idx) => {
      loader.load(
        src,
        texture => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;

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
        },
        undefined,
        err => console.error('Texture load error:', err)
      );
    });
    scene.add(group);

    let frameId: number;
    const normalSpeed = 0.015;
    const captureSpeed = 0.015;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      group.rotation.y += capturingRef.current ? captureSpeed : normalSpeed;
      renderer.render(scene, camera);

      if (capturingRef.current) {
        frameCounterRef.current += 1;

        if (frameCounterRef.current >= MAX_CAPTURES) {
          capturingRef.current = false;
          mediaRecorderRef.current?.stop();
          console.log('WebM recording stopped');
        }
      }
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', applyRendererSize);
      renderer.dispose();
      scene.clear();
    };
  }, []);

  const startCapture = () => {
    if (capturingRef.current || !containerRef.current) return;

    capturingRef.current = true;
    frameCounterRef.current = 0;

    const canvas = containerRef.current.querySelector('canvas');
    if (!canvas) return;

    const stream = canvas.captureStream(60); // 60fps로 캡처
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9', // ✅ 투명 배경을 위한 VP9 코덱
    });

    chunksRef.current = [];

    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'carousel_capture.webm';
      a.click();
      URL.revokeObjectURL(url);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    console.log('WebM recording started');
  };

  return (
    <>
      <Head>
        <title>Three.js Carousel - Transparent WebM Capture</title>
      </Head>
      <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />
      <button
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          padding: '10px 20px',
          fontSize: '16px',
          zIndex: 9999,
        }}
        onClick={startCapture}
      >
        300프레임 WebM 캡처
      </button>
    </>
  );
}
