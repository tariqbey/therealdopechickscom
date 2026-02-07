import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RotateCw, ZoomIn, Check } from "lucide-react";

interface ImageEditorProps {
  imageUrl: string;
  onSave: (croppedBlob: Blob) => void;
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height,
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.95);
  });
}

const ImageEditor = ({ imageUrl, onSave }: ImageEditorProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [aspect, setAspect] = useState(9 / 16);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedImg(imageUrl, croppedAreaPixels);
      onSave(blob);
    } finally {
      setSaving(false);
    }
  };

  const aspects = [
    { label: "9:16", value: 9 / 16 },
    { label: "1:1", value: 1 },
    { label: "4:5", value: 4 / 5 },
    { label: "16:9", value: 16 / 9 },
    { label: "Free", value: 0 },
  ];

  return (
    <div className="space-y-4">
      {/* Crop area */}
      <div className="relative w-full h-[400px] rounded-xl overflow-hidden bg-black">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect || undefined}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      {/* Controls */}
      <div className="space-y-3 px-1">
        {/* Aspect Ratio */}
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1.5 block">Crop Ratio</label>
          <div className="flex gap-2">
            {aspects.map((a) => (
              <button
                key={a.label}
                onClick={() => setAspect(a.value)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  aspect === a.value
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Zoom */}
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
            <ZoomIn className="h-3 w-3" /> Zoom
          </label>
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.05}
            onValueChange={([v]) => setZoom(v)}
          />
        </div>

        {/* Rotation */}
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
            <RotateCw className="h-3 w-3" /> Rotation
          </label>
          <Slider
            value={[rotation]}
            min={0}
            max={360}
            step={1}
            onValueChange={([v]) => setRotation(v)}
          />
        </div>
      </div>

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-gradient-purple text-primary-foreground font-bold hover:opacity-90"
      >
        <Check className="h-4 w-4 mr-1" /> {saving ? "Processing..." : "Apply Crop"}
      </Button>
    </div>
  );
};

export default ImageEditor;
