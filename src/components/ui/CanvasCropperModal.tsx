import { useState, useRef, useEffect, useCallback } from "react";
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";

interface CanvasCropperModalProps {
  open: boolean;
  imageFile: File | null;
  onCrop: (croppedFile: File) => void;
  onCancel: () => void;
}

export function CanvasCropperModal({
  open,
  imageFile,
  onCrop,
  onCancel,
}: CanvasCropperModalProps) {
  const { t } = useTranslation();
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  // Snapshot the imageFile on open so closing the dialog doesn't re-trigger
  // the image-load effect mid-animation (which causes removeChild crashes).
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const objectUrlRef = useRef<string | null>(null);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = loadedImage;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas display size
    const size = Math.min(canvas.parentElement?.clientWidth || 360, 360);
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);

    // Calculate aspect ratio fit
    const imgRatio = img.width / img.height;
    let drawWidth = size;
    let drawHeight = size;

    if (imgRatio > 1) {
      // Landscape: fit height first
      drawHeight = size;
      drawWidth = size * imgRatio;
    } else {
      // Portrait/Square: fit width first
      drawWidth = size;
      drawHeight = size / imgRatio;
    }

    // Apply scale
    const w = drawWidth * scale;
    const h = drawHeight * scale;

    // Draw image centered + offset
    const x = (size - w) / 2 + offset.x;
    const y = (size - h) / 2 + offset.y;

    ctx.save();
    // Clip to square cropping area
    const cropSize = size - 40; // 20px padding on each side
    const cropX = 20;
    const cropY = 20;

    // Draw the image
    ctx.drawImage(img, x, y, w, h);

    // Draw darkened overlay outside crop area
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    // Top overlay
    ctx.fillRect(0, 0, size, cropY);
    // Bottom overlay
    ctx.fillRect(0, cropY + cropSize, size, size - (cropY + cropSize));
    // Left overlay
    ctx.fillRect(0, cropY, cropX, cropSize);
    // Right overlay
    ctx.fillRect(cropX + cropSize, cropY, size - (cropX + cropSize), cropSize);

    // Draw crop border box
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(cropX, cropY, cropSize, cropSize);

    ctx.restore();
  }, [scale, offset, loadedImage]);

  // Only snapshot the file when the modal opens; ignore changes while closing.
  useEffect(() => {
    if (open && imageFile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveFile(imageFile);
    }
    if (!open) {
      // Defer clearing so the close animation can finish without DOM conflict.
      const t = setTimeout(() => {
        setActiveFile(null);
        setLoadedImage(null);
        setScale(1);
        setOffset({ x: 0, y: 0 });
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open, imageFile]);

  // Load image from the snapshotted file.
  useEffect(() => {
    if (!activeFile) return;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const url = URL.createObjectURL(activeFile);
    objectUrlRef.current = url;
    const img = new Image();
    img.onload = () => {
      setLoadedImage(img);
      setScale(1);
      setOffset({ x: 0, y: 0 });
    };
    img.src = url;
  }, [activeFile]);

  // Redraw when scale, offset or image loads
  useEffect(() => {
    if (loadedImage) {
      drawCanvas();
    }
  }, [scale, offset, loadedImage, drawCanvas]);

  const getEventCoords = (e: MouseEvent | TouchEvent | ReactMouseEvent | ReactTouchEvent) => {
    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const handleStart = (e: ReactMouseEvent | ReactTouchEvent) => {
    const coords = getEventCoords(e);
    if (!coords) return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: coords.x - offset.x,
      y: coords.y - offset.y,
    };
  };

  const handleMove = (e: ReactMouseEvent | ReactTouchEvent) => {
    if (!isDraggingRef.current) return;
    const coords = getEventCoords(e);
    if (!coords) return;

    const newX = coords.x - dragStartRef.current.x;
    const newY = coords.y - dragStartRef.current.y;
    setOffset({ x: newX, y: newY });
  };

  const handleEnd = () => {
    isDraggingRef.current = false;
  };

  const handleCrop = async () => {
    const img = loadedImage;
    const canvas = canvasRef.current;
    if (!img || !canvas || !imageFile) return;

    setLoading(true);
    try {
      const size = canvas.width;
      const cropSize = size - 40;
      const cropX = 20;
      const cropY = 20;

      const imgRatio = img.width / img.height;
      let drawWidth = size;
      let drawHeight = size;

      if (imgRatio > 1) {
        drawHeight = size;
        drawWidth = size * imgRatio;
      } else {
        drawWidth = size;
        drawHeight = size / imgRatio;
      }

      const w = drawWidth * scale;
      const h = drawHeight * scale;

      const x = (size - w) / 2 + offset.x;
      const y = (size - h) / 2 + offset.y;

      const scaleX = img.width / w;
      const scaleY = img.height / h;

      const sx = (cropX - x) * scaleX;
      const sy = (cropY - y) * scaleY;
      const sWidth = cropSize * scaleX;
      const sHeight = cropSize * scaleY;

      const outputCanvas = document.createElement("canvas");
      const targetSize = Math.max(512, Math.min(img.width, img.height));
      outputCanvas.width = targetSize;
      outputCanvas.height = targetSize;

      const outCtx = outputCanvas.getContext("2d");
      if (outCtx) {
        outCtx.drawImage(
          img,
          sx,
          sy,
          sWidth,
          sHeight,
          0,
          0,
          targetSize,
          targetSize
        );
      }

      outputCanvas.toBlob(
        (blob) => {
          if (blob) {
            const croppedFile = new File([blob], imageFile.name.replace(/\.[^/.]+$/, "") + ".png", {
              type: "image/png",
            });
            onCrop(croppedFile);
          }
          setLoading(false);
        },
        "image/png",
        0.95
      );
    } catch (err) {
      console.error("Cropping failed:", err);
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t("cropper.title")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative overflow-hidden rounded-lg border border-border bg-surface-raised">
            <canvas
              ref={canvasRef}
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
              className="cursor-move touch-none"
            />
          </div>
          <div className="flex w-full items-center gap-3 px-4">
            <ZoomOut className="size-4 text-foreground-muted" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-border"
            />
            <ZoomIn className="size-4 text-foreground-muted" />
          </div>
          <p className="text-xs text-foreground-muted">
            {t("cropper.hint")}
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {t("cropper.cancel")}
          </Button>
          <Button onClick={handleCrop} disabled={loading} className="gap-2">
            {loading && <Loader2 className="size-4 animate-spin" />}
            {t("cropper.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
