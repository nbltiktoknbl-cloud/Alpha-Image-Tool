
import React, { useState } from 'react';
import ImageUpload from './ImageUpload';
import ActionButton from './ActionButton';
import Spinner from './Spinner';
import { upscaleImageWithGemini } from '../services/geminiService';

declare var JSZip: any;

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = error => reject(error);
  });
};

type ImageState = {
  id: string;
  originalFile: File;
  originalUrl: string;
  upscaledUrl: string | null;
  isLoading: boolean;
  error: string | null;
};

const UpscalerView: React.FC = () => {
  const [images, setImages] = useState<ImageState[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleReset = () => {
    images.forEach(img => URL.revokeObjectURL(img.originalUrl));
    setImages([]);
    setIsProcessing(false);
    setProgress({ current: 0, total: 0 });
  };

  const handleImageSelect = (files: File[]) => {
    handleReset();
    const newImages: ImageState[] = files.map(file => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      originalFile: file,
      originalUrl: URL.createObjectURL(file),
      upscaledUrl: null,
      isLoading: false,
      error: null,
    }));
    setImages(newImages);
  };

  const handleUpscale = async () => {
    if (images.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setProgress({ current: 0, total: images.length });
    setImages(prev => prev.map(img => ({ ...img, isLoading: true, error: null })));

    const processImage = async (image: ImageState): Promise<ImageState> => {
      try {
        const base64Data = await fileToBase64(image.originalFile);
        const newImageUrl = await upscaleImageWithGemini(base64Data, image.originalFile.type);
        return { ...image, upscaledUrl: newImageUrl, isLoading: false };
      } catch (e) {
        const err = e as Error;
        return { ...image, error: err.message || 'An unexpected error occurred.', isLoading: false };
      } finally {
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
    };
    
    const promises = images.map(processImage);
    const updatedImages = await Promise.all(promises);

    setImages(updatedImages);
    setIsProcessing(false);
  };

  const handleDownload = (imageUrl: string, originalFile: File) => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    const originalName = originalFile.name.split('.')[0] || 'image';
    const extension = imageUrl.substring(imageUrl.indexOf('/') + 1, imageUrl.indexOf(';'));
    link.download = `${originalName}_upscaled.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    const upscaledImages = images.filter(img => img.upscaledUrl);

    if (upscaledImages.length === 0) return;

    for (const image of upscaledImages) {
      const response = await fetch(image.upscaledUrl!);
      const blob = await response.blob();
      const originalName = image.originalFile.name.split('.')[0] || 'image';
      const extension = image.upscaledUrl!.substring(image.upscaledUrl!.indexOf('/') + 1, image.upscaledUrl!.indexOf(';'));
      const filename = `${originalName}_upscaled.${extension}`;
      zip.file(filename, blob);
    }

    zip.generateAsync({ type: 'blob' }).then((content: Blob) => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `upscaled_images_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    });
  };

  const successfullyUpscaledCount = images.filter(img => img.upscaledUrl).length;

  return (
    <div className="w-full flex-grow flex flex-col items-center justify-center p-4">
      {images.length === 0 ? (
        <ImageUpload onImageSelect={handleImageSelect} multiple={true} />
      ) : (
        <div className="w-full max-w-7xl mx-auto flex flex-col items-center">
          {/* Controls Section */}
          <div className="w-full p-6 bg-gray-800/50 rounded-xl border border-gray-700 mb-8 sticky top-4 z-10 backdrop-blur-sm">
            <div className="flex flex-wrap justify-center items-center gap-4">
              <ActionButton onClick={handleUpscale} disabled={isProcessing}>
                {isProcessing ? `Upscaling... (${progress.current}/${progress.total})` : `Upscale ${images.length} Image(s)`}
              </ActionButton>
              {successfullyUpscaledCount > 0 && (
                <ActionButton onClick={handleDownloadAll} variant="primary" disabled={isProcessing}>
                  Download All (.zip)
                </ActionButton>
              )}
              <ActionButton onClick={handleReset} variant="secondary" disabled={isProcessing}>
                Start Over
              </ActionButton>
            </div>
            {isProcessing && (
              <div className="w-full bg-gray-700 rounded-full h-2.5 mt-4">
                <div className="bg-teal-500 h-2.5 rounded-full" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
              </div>
            )}
          </div>

          {/* Image Grid */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {images.map(image => (
              <div key={image.id} className="bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700 flex flex-col">
                <div className="relative w-full aspect-square">
                  {image.isLoading && (
                    <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center z-10">
                      <Spinner />
                    </div>
                  )}
                  <img src={image.originalUrl} alt={image.originalFile.name} className="w-full h-full object-contain" />

                  {image.upscaledUrl && (
                    <img src={image.upscaledUrl} alt="Upscaled" className="absolute inset-0 w-full h-full object-contain opacity-0 hover:opacity-100 transition-opacity duration-300" />
                  )}
                </div>
                <div className="p-4 flex flex-col flex-grow">
                  <p className="text-sm text-gray-400 truncate" title={image.originalFile.name}>{image.originalFile.name}</p>
                  {image.error && <p className="text-xs text-red-400 mt-1">Error: {image.error}</p>}
                </div>
                {image.upscaledUrl && !image.isLoading && (
                  <div className="p-3 bg-gray-800/50 border-t border-gray-700">
                    <ActionButton onClick={() => handleDownload(image.upscaledUrl!, image.originalFile)} className="w-full py-2">
                      Download
                    </ActionButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UpscalerView;
