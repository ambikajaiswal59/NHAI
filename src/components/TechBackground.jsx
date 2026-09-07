// src/components/TechBackground.jsx

import { useEffect, useRef } from "react";

export default function TechBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    let width = 0;
    let height = 0;
    let nodes = [];
    let radarAngle = 0;
    let animationFrameId;

    const COLORS = {
      bg: "#0b1329",
      grid: "rgba(0, 240, 255, 0.05)",
      nodeNormal: "#00f0ff",
      nodeAlert: "#ff3366",
      nodeWarning: "#ffaa00",
    };

    class Node {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;

        this.vx = (Math.random() - 0.5) * 0.6;
        this.vy = (Math.random() - 0.5) * 0.6;

        this.radius = Math.random() * 2 + 2;

        const rand = Math.random();

        this.status =
          rand > 0.85
            ? "alert"
            : rand > 0.7
            ? "warning"
            : "normal";

        this.color =
          this.status === "alert"
            ? COLORS.nodeAlert
            : this.status === "warning"
            ? COLORS.nodeWarning
            : COLORS.nodeNormal;

        this.pulse = Math.random() * Math.PI;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > width) {
          this.vx *= -1;
        }

        if (this.y < 0 || this.y > height) {
          this.vy *= -1;
        }

        this.pulse += 0.05;
      }

      draw() {
        const currentRadius =
          this.radius + Math.sin(this.pulse) * 1.5;

        ctx.beginPath();

        ctx.arc(
          this.x,
          this.y,
          Math.max(1, currentRadius),
          0,
          Math.PI * 2
        );

        ctx.fillStyle = this.color;

        ctx.shadowColor = this.color;
        ctx.shadowBlur =
          this.status === "normal" ? 6 : 12;

        ctx.fill();

        ctx.shadowBlur = 0;
      }
    }

    const initNodes = () => {
      nodes = [];

      // Keep the number of nodes reasonable on large screens.
      const count = Math.min(
        100,
        Math.floor((width * height) / 18000)
      );

      for (let i = 0; i < count; i++) {
        nodes.push(new Node());
      }
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;

      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      initNodes();
    };

    const drawGrid = () => {
      const gridSize = 60;

      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;

      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    };

    const drawRadar = () => {
      const centerX = width / 2;
      const centerY = height / 2;

      const radius = Math.max(width, height) * 0.7;

      radarAngle += 0.005;

      ctx.save();

      ctx.translate(centerX, centerY);

      // createConicGradient is supported in modern browsers.
      const gradient = ctx.createConicGradient(
        radarAngle,
        0,
        0
      );

      gradient.addColorStop(
        0,
        "rgba(0, 240, 255, 0.15)"
      );

      gradient.addColorStop(
        0.1,
        "rgba(0, 240, 255, 0.02)"
      );

      gradient.addColorStop(0.2, "transparent");
      gradient.addColorStop(1, "transparent");

      ctx.fillStyle = gradient;

      ctx.beginPath();

      ctx.arc(
        0,
        0,
        radius,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.restore();
    };

    const drawConnections = () => {
      const maxDistance = 140;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;

          const distance = Math.sqrt(
            dx * dx + dy * dy
          );

          if (distance < maxDistance) {
            const alpha =
              (1 - distance / maxDistance) * 0.25;

            ctx.beginPath();

            ctx.moveTo(
              nodes[i].x,
              nodes[i].y
            );

            ctx.lineTo(
              nodes[j].x,
              nodes[j].y
            );

            ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;

            ctx.lineWidth = 0.8;

            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      ctx.fillStyle = COLORS.bg;

      ctx.fillRect(
        0,
        0,
        width,
        height
      );

      drawGrid();
      drawRadar();
      drawConnections();

      nodes.forEach((node) => {
        node.update();
        node.draw();
      });

      animationFrameId =
        requestAnimationFrame(animate);
    };

    resize();

    window.addEventListener(
      "resize",
      resize
    );

    animate();

    return () => {
      window.removeEventListener(
        "resize",
        resize
      );

      cancelAnimationFrame(
        animationFrameId
      );
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Dark overlay to keep the login form readable */}
      <div className="absolute inset-0 bg-[#0b1329]/20" />
    </div>
  );
}