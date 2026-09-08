import { useEffect, useRef } from "react";

export default function TechBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    let width = 0;
    let height = 0;
    let nodes = [];
    let radarAngle = 0;
    let animationFrameId = null;

    // =========================================================
    // NHAI AI MONITORING COLOR THEME
    // =========================================================

    const COLORS = {
      bg: "#0b1329",

      grid: "rgba(0, 240, 255, 0.05)",

      nodeNormal: "#00f0ff",

      nodeAlert: "#ff3366",

      nodeWarning: "#ffaa00",
    };

    // =========================================================
    // NODE CLASS
    // =========================================================

    class Node {
      constructor(id) {
        this.id = id;

        // Random starting position
        this.x = Math.random() * width;
        this.y = Math.random() * height;

        // Slow floating movement
        this.vx = (Math.random() - 0.5) * 0.6;
        this.vy = (Math.random() - 0.5) * 0.6;

        // Random node size
        this.radius = Math.random() * 2 + 2;

        // -----------------------------------------------------
        // Randomly assign status
        //
        // > 85%  = Alert
        // > 70%  = Warning
        // Otherwise = Normal
        // -----------------------------------------------------

        const random = Math.random();

        this.status =
          random > 0.85
            ? "alert"
            : random > 0.7
            ? "warning"
            : "normal";

        // Assign color according to status
        this.color =
          this.status === "alert"
            ? COLORS.nodeAlert
            : this.status === "warning"
            ? COLORS.nodeWarning
            : COLORS.nodeNormal;

        // Random animation phase
        this.pulse = Math.random() * Math.PI;
      }

      // =======================================================
      // UPDATE NODE POSITION
      // =======================================================

      update() {
        this.x += this.vx;
        this.y += this.vy;

        // Bounce from left/right edges
        if (this.x < 0 || this.x > width) {
          this.vx *= -1;
        }

        // Bounce from top/bottom edges
        if (this.y < 0 || this.y > height) {
          this.vy *= -1;
        }

        // Pulsing animation
        this.pulse += 0.05;
      }

      // =======================================================
      // DRAW NODE
      // =======================================================

      draw() {
        ctx.beginPath();

        // Pulsing radius
        const currentRadius =
          this.radius + Math.sin(this.pulse) * 1.5;

        ctx.arc(
          this.x,
          this.y,
          Math.max(1, currentRadius),
          0,
          Math.PI * 2
        );

        // Node color
        ctx.fillStyle = this.color;

        // Glow
        ctx.shadowColor = this.color;

        ctx.shadowBlur =
          this.status === "normal"
            ? 6
            : 12;

        ctx.fill();

        // Reset shadow after drawing
        ctx.shadowBlur = 0;

        // =====================================================
        // HIGH RISK LABEL
        // =====================================================

        if (this.status === "alert") {
          ctx.font = "11px monospace";

          ctx.fillStyle = COLORS.nodeAlert;

          ctx.fillText(
            "HIGH RISK",
            this.x + 8,
            this.y + 3
          );
        }
      }
    }

    // =========================================================
    // INITIALIZE NODES
    // =========================================================

    const initNodes = () => {
      nodes = [];

      /*
       * Same density calculation as TL's HTML:
       *
       * width * height / 18000
       *
       * This automatically adjusts the number of nodes
       * according to screen resolution.
       */

      const count = Math.floor(
        (width * height) / 18000
      );

      for (let i = 0; i < count; i++) {
        nodes.push(new Node(i + 100));
      }
    };

    // =========================================================
    // RESIZE CANVAS
    // =========================================================

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;

      /*
       * Device Pixel Ratio makes the canvas sharper on
       * high-resolution screens.
       *
       * Capped at 2 so rendering doesn't become unnecessarily
       * expensive on very high-DPI displays.
       */

      const dpr = Math.min(
        window.devicePixelRatio || 1,
        2
      );

      canvas.width = width * dpr;
      canvas.height = height * dpr;

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      /*
       * Scale the drawing coordinate system back to CSS pixels.
       */

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );

      initNodes();
    };

    // =========================================================
    // DRAW GRID
    // =========================================================

    const drawGrid = () => {
      const gridSize = 60;

      ctx.strokeStyle = COLORS.grid;

      ctx.lineWidth = 1;

      // -------------------------------------------------------
      // Vertical grid lines
      // -------------------------------------------------------

      for (
        let x = 0;
        x < width;
        x += gridSize
      ) {
        ctx.beginPath();

        ctx.moveTo(x, 0);

        ctx.lineTo(x, height);

        ctx.stroke();
      }

      // -------------------------------------------------------
      // Horizontal grid lines
      // -------------------------------------------------------

      for (
        let y = 0;
        y < height;
        y += gridSize
      ) {
        ctx.beginPath();

        ctx.moveTo(0, y);

        ctx.lineTo(width, y);

        ctx.stroke();
      }
    };

    // =========================================================
    // DRAW RADAR SWEEP
    // =========================================================

    const drawRadar = () => {
      const centerX = width / 2;
      const centerY = height / 2;

      const radius =
        Math.max(width, height) * 0.7;

      // Same speed as TL HTML
      radarAngle += 0.005;

      ctx.save();

      ctx.translate(
        centerX,
        centerY
      );

      /*
       * createConicGradient is supported by modern browsers.
       */

      if (
        typeof ctx.createConicGradient ===
        "function"
      ) {
        const gradient =
          ctx.createConicGradient(
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

        gradient.addColorStop(
          0.2,
          "transparent"
        );

        gradient.addColorStop(
          1,
          "transparent"
        );

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
      }

      ctx.restore();
    };

    // =========================================================
    // DRAW CONNECTIONS BETWEEN NEARBY NODES
    // =========================================================

    const drawConnections = () => {
      const maxDistance = 140;

      for (
        let i = 0;
        i < nodes.length;
        i++
      ) {
        for (
          let j = i + 1;
          j < nodes.length;
          j++
        ) {
          const dx =
            nodes[i].x -
            nodes[j].x;

          const dy =
            nodes[i].y -
            nodes[j].y;

          const distance = Math.sqrt(
            dx * dx + dy * dy
          );

          // Only connect nearby nodes
          if (distance < maxDistance) {
            const alpha =
              (1 - distance / maxDistance) *
              0.25;

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

    // =========================================================
    // MAIN ANIMATION LOOP
    // =========================================================

    const animate = () => {
      // -------------------------------------------------------
      // Background
      // -------------------------------------------------------

      ctx.fillStyle = COLORS.bg;

      ctx.fillRect(
        0,
        0,
        width,
        height
      );

      // -------------------------------------------------------
      // Grid
      // -------------------------------------------------------

      drawGrid();

      // -------------------------------------------------------
      // Radar
      // -------------------------------------------------------

      drawRadar();

      // -------------------------------------------------------
      // Network connections
      // -------------------------------------------------------

      drawConnections();

      // -------------------------------------------------------
      // Nodes
      // -------------------------------------------------------

      nodes.forEach((node) => {
        node.update();
        node.draw();
      });

      // Continue animation
      animationFrameId =
        requestAnimationFrame(animate);
    };

    // =========================================================
    // INITIALIZATION
    // =========================================================

    resize();

    window.addEventListener(
      "resize",
      resize
    );

    animate();

    // =========================================================
    // CLEANUP
    // =========================================================

    return () => {
      window.removeEventListener(
        "resize",
        resize
      );

      if (animationFrameId !== null) {
        cancelAnimationFrame(
          animationFrameId
        );
      }
    };
  }, []);

  // ===========================================================
  // CANVAS CONTAINER
  // ===========================================================

  return (
    <div
      className="
        fixed
        inset-0
        z-0
        w-full
        h-full
        overflow-hidden
        pointer-events-none
      "
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="
          absolute
          inset-0
          w-full
          h-full
        "
      />
    </div>
  );
}