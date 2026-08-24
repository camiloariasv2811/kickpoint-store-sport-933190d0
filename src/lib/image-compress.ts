/**
 * Comprime y redimensiona una imagen en el navegador antes de subirla.
 * Las fotos originales (PNG de 2–8 MB) hacían fallar la subida y volvían
 * la galería del producto muy lenta; aquí se convierten a JPEG optimizado.
 */
export type CompressedImage = {
  base64: string;
  contentType: string;
  fileName: string;
};

const MAX_SIDE = 1400;
const QUALITY = 0.82;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

export async function compressImageFile(file: File): Promise<CompressedImage> {
  const baseName = file.name.replace(/\.[^.]+$/, "") || "imagen";

  // Los SVG y los archivos ya livianos se envían tal cual.
  if (file.type === "image/svg+xml" || (file.size <= 350_000 && file.type !== "image/png")) {
    return { base64: await fileToBase64(file), contentType: file.type, fileName: file.name };
  }

  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas no disponible");
    // Fondo blanco para PNG con transparencia (JPEG no soporta alfa).
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
    const base64 = dataUrl.split(",")[1] || "";
    if (!base64) throw new Error("Compresión vacía");

    return { base64, contentType: "image/jpeg", fileName: `${baseName}.jpg` };
  } catch {
    // Si la compresión falla, se intenta con el archivo original.
    return { base64: await fileToBase64(file), contentType: file.type, fileName: file.name };
  }
}
