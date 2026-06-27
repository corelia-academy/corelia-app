/**
 * Validates if the file is a true PNG image by checking its file signature (magic bytes).
 * PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
 */
export function validatePngSignature(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (!buffer || buffer.byteLength < 8) {
        resolve(false);
        return;
      }
      const bytes = new Uint8Array(buffer);
      const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      const isValid = signature.every((val, i) => bytes[i] === val);
      resolve(isValid);
    };
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(file.slice(0, 8));
  });
}

/**
 * Reads image dimensions and determines if it is a square (1:1 ratio).
 */
export function checkImageDimensions(
  file: File,
): Promise<{ width: number; height: number; isSquare: boolean }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.width,
        height: img.height,
        isSquare: img.width === img.height,
      });
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}
