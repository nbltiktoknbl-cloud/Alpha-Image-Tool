
import React, { useState, useEffect, useCallback } from 'react';
import ImageUpload from './ImageUpload';
import ActionButton from './ActionButton';
import Spinner from './Spinner';
import { compressImageWithGemini } from '../services/geminiService';

declare var JSZip: any;

// Helper function to convert a File to a base64 string (without the data: prefix)
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
  compressedUrl: string | null;
  isLoading: boolean;
  error: string | null;
};

const qualityPresets = [
    { name: 'Low', quality: 40, detailLevel: 40 },
    { name: 'Medium', quality: 75, detailLevel: 75 },
    { name: 'High', quality: 90, detailLevel: 90 },
] as const;

const resolutionPresets = [
    { name: 'Original', value: 'original' },
    { name: 'Full HD (1080p)', value: '1920x1080' },
    { name: 'HD (720p)', value: '1280x720' },
    { name: 'Standard (480p)', value: '640x480' },
] as const;


const CompressorView: React.FC = () => {
  const [images, setImages] = useState<ImageState[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Settings
  const [outputFormat, setOutputFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/png');
  const [quality, setQuality] = useState<number>(75);
  const [detailLevel, setDetailLevel] = useState<number>(75);
  const [autoCompress, setAutoCompress] = useState<boolean>(false);
  const [targetResolution, setTargetResolution] = useState<string>('original');

  const handleReset = () => {
    images.forEach(img => URL.revokeObjectURL(img.originalUrl));
    setImages([]);
    setIsProcessing(false);
    // Do not reset settings, user might want to keep them for the next batch
    setProgress({ current: 0, total: 0 });
  };

  const handleImageSelect = (files: File[]) => {
    handleReset();
    const newImages: ImageState[] = files.map(file => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      originalFile: file,
      originalUrl: URL.createObjectURL(file),
      compressedUrl: null,
      isLoading: false,
      error: null,
    }));
    setImages(newImages);
  };

  const handleCompress = useCallback(async () => {
    if (images.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setProgress({ current: 0, total: images.length });
    setImages(prev => prev.map(img => ({ ...img, isLoading: true, error: null, compressedUrl: null })));

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      try {
        const base64Data = await fileToBase64(image.originalFile);
        const newImageUrl = await compressImageWithGemini(base64Data, image.originalFile.type, outputFormat, quality, detailLevel, targetResolution);
        setImages(prevImages =>
          prevImages.map(img =>
            img.id === image.id ? { ...img, compressedUrl: newImageUrl, isLoading: false } : img
          )
        );
      } catch (e) {
        const err = e as Error;
        setImages(prevImages =>
          prevImages.map(img =>
            img.id === image.id
              ? { ...img, error: err.message || 'An unexpected error occurred.', isLoading: false }
              : img
          )
        );
      }
      setProgress(prev => ({ ...prev, current: i + 1 }));
    }

    setIsProcessing(false);
  }, [images, isProcessing, outputFormat, quality, detailLevel, targetResolution]);
  
  // Effect to trigger compression automatically if the toggle is on
  useEffect(() => {
    // Check if auto-compress is on, not already processing, and there are unprocessed images.
    const hasUnprocessedImages = images.length > 0 && !images[0].isLoading && !images[0].compressedUrl && !images[0].error;
    if (autoCompress && !isProcessing && hasUnprocessedImages) {
      handleCompress();
    }
  }, [images, autoCompress, isProcessing, handleCompress]);


  const handleDownload = (imageUrl: string, originalFile: File) => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    const originalName = originalFile.name.split('.')[0] || 'image';
    const extension = outputFormat.split('/')[1].replace('jpeg', 'jpg');
    link.download = `${originalName}_compressed_q${quality}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    const compressedImages = images.filter(img => img.compressedUrl);

    if (compressedImages.length === 0) return;

    for (const image of compressedImages) {
        const response = await fetch(image.compressedUrl!);
        const blob = await response.blob();
        const originalName = image.originalFile.name.split('.')[0] || 'image';
        const extension = outputFormat.split('/')[1].replace('jpeg', 'jpg');
        const filename = `${originalName}_compressed_q${quality}.${extension}`;
        zip.file(filename, blob);
    }

    zip.generateAsync({ type: 'blob' }).then((content: Blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `compressed_images_${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    });
  };

  const successfullyCompressedCount = images.filter(img => img.compressedUrl).length;
  const outputFormats = ['image/png', 'image/jpeg', 'image/webp'] as const;

  return (
    <div className="w-full flex-grow flex flex-col items-center justify-center p-4">
      {images.length === 0 ? (
        <ImageUpload onImageSelect={handleImageSelect} multiple={true} />
      ) : (
        <div className="w-full max-w-7xl mx-auto flex flex-col items-center">
          {/* Controls Section */}
          <div className="w-full p-6 bg-gray-800/50 rounded-xl border border-gray-700 mb-8 sticky top-4 z-10 backdrop-blur-sm">
            {/* Reorganized control panel with presets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Column 1: Presets */}
              <div className="flex flex-col space-y-2">
                <label className="font-semibold text-gray-300">Quality Presets</label>
                <div className="flex space-x-2">
                  {qualityPresets.map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        setQuality(preset.quality);
                        setDetailLevel(preset.detailLevel);
                      }}
                      className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${
                        quality === preset.quality && detailLevel === preset.detailLevel
                          ? 'bg-teal-500 text-white shadow-lg'
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                      }`}
                      disabled={isProcessing}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Column 2: Sliders */}
              <div className="flex flex-col space-y-4">
                  <div>
                    <label htmlFor="quality" className="flex justify-between font-semibold text-gray-300">
                      <span>Visual Quality</span>
                      <span className="text-teal-400 font-mono">{quality}</span>
                    </label>
                    <input
                      id="quality"
                      type="range"
                      min="1"
                      max="100"
                      value={quality}
                      onChange={(e) => setQuality(Number(e.target.value))}
                      disabled={isProcessing}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="detailLevel" className="flex justify-between font-semibold text-gray-300">
                        <span>Detail Level</span>
                        <span className="text-teal-400 font-mono">{detailLevel}</span>
                    </label>
                    <input
                      id="detailLevel"
                      type="range"
                      min="1"
                      max="100"
                      value={detailLevel}
                      onChange={(e) => setDetailLevel(Number(e.target.value))}
                      disabled={isProcessing}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                    />
                  </div>
              </div>

              {/* Column 3: Format & Auto-Compress */}
              <div className="flex flex-col space-y-4">
                <div>
                    <label htmlFor="targetResolution" className="block font-semibold text-gray-300 mb-1">Target Resolution</label>
                    <select
                      id="targetResolution"
                      value={targetResolution}
                      onChange={(e) => setTargetResolution(e.target.value)}
                      disabled={isProcessing}
                      className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-teal-500 focus:border-teal-500"
                    >
                      {resolutionPresets.map(res => <option key={res.value} value={res.value}>{res.name}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="outputFormat" className="block font-semibold text-gray-300 mb-1">Output Format</label>
                    <select
                      id="outputFormat"
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value as typeof outputFormat)}
                      disabled={isProcessing}
                      className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-teal-500 focus:border-teal-500"
                    >
                      {outputFormats.map(format => <option key={format} value={format}>{format.split('/')[1].toUpperCase()}</option>)}
                    </select>
                </div>
                <div className="flex items-center justify-start pt-2">
                    <label htmlFor="autoCompress" className="flex items-center cursor-pointer">
                        <div className="relative">
                        <input
                            type="checkbox"
                            id="autoCompress"
                            className="sr-only"
                            checked={autoCompress}
                            onChange={() => setAutoCompress(prev => !prev)}
                            disabled={isProcessing}
                        />
                        <div className={`block w-14 h-8 rounded-full ${autoCompress ? 'bg-teal-500' : 'bg-gray-600'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${autoCompress ? 'transform translate-x-6' : ''}`}></div>
                        </div>
                        <div className="ml-3 text-gray-300 font-semibold">Auto-start</div>
                    </label>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 pt-6 border-t border-gray-700 flex flex-wrap justify-center items-center gap-4">
              <ActionButton onClick={handleCompress} disabled={isProcessing}>
                {isProcessing ? `Processing... (${progress.current}/${progress.total})` : `Compress ${images.length} Image(s)`}
              </ActionButton>
              {successfullyCompressedCount > 0 && (
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
                  <div className="absolute top-2 left-2 bg-gray-900/70 text-white text-xs px-2 py-1 rounded-full">
                    {(image.originalFile.size / 1024).toFixed(1)} KB
                  </div>
                  <img src={image.originalUrl} alt={image.originalFile.name} className="w-full h-full object-contain" />

                  {image.compressedUrl && (
                    <>
                      <div className="absolute top-2 right-2 bg-teal-900/70 text-teal-200 text-xs px-2 py-1 rounded-full">
                         {/* Placeholder for compressed size */}
                      </div>
                      <img src={image.compressedUrl} alt="Compressed" className="absolute inset-0 w-full h-full object-contain opacity-0 hover:opacity-100 transition-opacity duration-300" />
                    </>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-grow">
                    <p className="text-sm text-gray-400 truncate" title={image.originalFile.name}>{image.originalFile.name}</p>
                    {image.error && <p className="text-xs text-red-400 mt-1">Error: {image.error}</p>}
                </div>
                {image.compressedUrl && !image.isLoading && (
                  <div className="p-3 bg-gray-800/50 border-t border-gray-700">
                    <ActionButton onClick={() => handleDownload(image.compressedUrl!, image.originalFile)} className="w-full py-2">
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

export default CompressorView;