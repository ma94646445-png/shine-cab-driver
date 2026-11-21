import React, { useRef } from 'react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Camera, UploadCloud } from 'lucide-react';

interface CameraCaptureModalProps {
  open: boolean;
  title?: string;
  facingMode?: 'user' | 'environment';
  onClose: () => void;
  onCapture: (file: File) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = () => null;

interface PhotoCaptureControlProps {
  accept?: string;
  busy?: boolean;
  cameraTitle?: string;
  facingMode?: 'user' | 'environment';
  onSelectFile: (file: File) => void;
  cameraLabel?: string;
  uploadLabel?: string;
}

export const PhotoActionButtons: React.FC<PhotoCaptureControlProps> = ({
  accept = 'image/*,application/pdf',
  busy = false,
  onSelectFile,
  cameraLabel = 'Click Photo',
  uploadLabel = 'Upload',
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleNativeCamera = async () => {
    try {
      await CapCamera.requestPermissions({ permissions: ['camera', 'photos'] }).catch(() => {});
      const photo = await CapCamera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });
      if (photo.dataUrl) {
        const res = await fetch(photo.dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `shine_captain_${Date.now()}.jpg`, { type: 'image/jpeg' });
        onSelectFile(file);
        return;
      }
    } catch {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={handleNativeCamera}
        className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#111111] px-3 text-xs font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 dark:bg-[#FFC928] dark:text-[#111111]"
      >
        <Camera className="h-3.5 w-3.5" />
        <span>{cameraLabel}</span>
      </button>

      <label className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-neutral-50 px-3 text-xs font-semibold text-[#111111] transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-[#1A1D23] dark:text-white dark:hover:bg-neutral-800">
        <UploadCloud className="h-3.5 w-3.5" />
        <span>{busy ? 'Uploading…' : uploadLabel}</span>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          disabled={busy}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onSelectFile(f);
            e.target.value = '';
          }}
        />
      </label>
    </div>
  );
};
export const PhotoCaptureControl = PhotoActionButtons;
