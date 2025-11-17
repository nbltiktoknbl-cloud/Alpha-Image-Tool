
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ImageUpload from './ImageUpload';
import ActionButton from './ActionButton';
import Spinner from './Spinner';
import { editImageWithGemini, ResizeConfig, CropConfig, TextOverlayConfig, FilterConfig, TransparencyConfig, WatermarkConfig } from '../services/geminiService';

declare var JSZip: any;

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

const dataUrlToBase64 = (dataUrl: string): string => dataUrl.split(',')[1];

const LOCAL_STORAGE_KEY = 'alphaImageEditorState_v3';

type ImageState = {
    id: string;
    originalDataUrl: string;
    originalFileName: string;
    originalFileType: string;
    editedUrl: string | null;
    isLoading: boolean;
    error: string | null;
};

type WatermarkPosition = 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

type Settings = {
  userPrompt: string;
  outputFormat: 'image/png' | 'image/jpeg' | 'image/webp';
  outputQuality: number;
  resizeConfig: ResizeConfig;
  cropConfig: CropConfig;
  rotationAngle: number;
  textOverlayConfig: TextOverlayConfig;
  filterConfig: FilterConfig;
  transparencyConfig: TransparencyConfig;
  watermarkConfig: WatermarkConfig;
};

const defaultSettings: Settings = {
    userPrompt: 'Make this image look more professional and vibrant.',
    outputFormat: 'image/png',
    outputQuality: 92,
    resizeConfig: { enabled: false, width: 1024, height: 1024, maintainAspectRatio: true },
    cropConfig: { enabled: false, x: 10, y: 10, width: 80, height: 80 },
    rotationAngle: 0,
    textOverlayConfig: { enabled: false, content: 'Your Text Here', font: 'Arial, sans-serif', size: 48, color: '#FFFFFF', positionX: 50, positionY: 50 },
    filterConfig: { grayscale: { enabled: false, intensity: 100 }, brightness: 100, contrast: 100 },
    transparencyConfig: { method: 'preserve', fillColor: '#FFFFFF' },
    watermarkConfig: { enabled: false, text: 'Watermark', opacity: 50, scale: 25, color: '#FFFFFF', position: 'bottom-right' }
};

const EditorView: React.FC = () => {
  const [images, setImages] = useState<ImageState[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());

  // All settings are managed in a single state object
  const [settings, setSettings] = useState<Settings>(() => {
      try {
        const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
        return savedState ? JSON.parse(savedState) : defaultSettings;
      } catch (e) {
        return defaultSettings;
      }
  });

  // Persist settings to local storage
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const handleReset = () => {
    setImages([]);
    setIsProcessing(false);
    setProgress({ current: 0, total: 0 });
    setSelectedImageIds(new Set());
    // Do not reset settings
  };

  const handleImageSelect = async (files: File[]) => {
    handleReset();
    const newImages: ImageState[] = await Promise.all(
        files.map(async (file) => ({
            id: `${file.name}-${file.lastModified}-${Math.random()}`,
            originalDataUrl: await fileToDataUrl(file),
            originalFileName: file.name,
            originalFileType: file.type,
            editedUrl: null,
            isLoading: false,
            error: null,
        }))
    );
    setImages(newImages);
  };
  
  const handleRemoveImage = (idToRemove: string) => {
    setImages(prev => prev.filter(img => img.id !== idToRemove));
    setSelectedImageIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(idToRemove);
        return newSet;
    });
  };

  const handleToggleSelection = (id: string) => {
    setSelectedImageIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        return newSet;
    });
  };

  const allSelected = useMemo(() => images.length > 0 && selectedImageIds.size === images.length, [images, selectedImageIds]);

  const handleToggleSelectAll = () => {
    if (allSelected) {
        setSelectedImageIds(new Set());
    } else {
        setSelectedImageIds(new Set(images.map(img => img.id)));
    }
  };


  const handleGenerateEdits = useCallback(async () => {
    // Only process images that are explicitly selected.
    const imagesToProcess = images.filter(img => selectedImageIds.has(img.id));

    if (imagesToProcess.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setProgress({ current: 0, total: imagesToProcess.length });

    // Set loading state only for the selected images
    setImages(prev => prev.map(img =>
        selectedImageIds.has(img.id)
            ? { ...img, isLoading: true, error: null, editedUrl: null }
            : img
    ));

    for (let i = 0; i < imagesToProcess.length; i++) {
        const image = imagesToProcess[i];
        try {
            const base64Data = dataUrlToBase64(image.originalDataUrl);
            const newImageUrl = await editImageWithGemini(
                base64Data,
                image.originalFileType,
                settings.userPrompt,
                settings.outputFormat,
                settings.outputQuality,
                settings.resizeConfig,
                settings.cropConfig,
                settings.rotationAngle,
                settings.textOverlayConfig,
                settings.filterConfig,
                settings.transparencyConfig,
                settings.watermarkConfig,
            );
            setImages(prev =>
                prev.map(img =>
                    img.id === image.id ? { ...img, editedUrl: newImageUrl, isLoading: false } : img
                )
            );
        } catch (e) {
            const err = e as Error;
            setImages(prev =>
                prev.map(img =>
                    img.id === image.id ? { ...img, error: err.message || 'An unexpected error occurred.', isLoading: false } : img
                )
            );
        }
        setProgress(prev => ({ ...prev, current: i + 1 }));
    }

    setIsProcessing(false);
  }, [images, isProcessing, selectedImageIds, settings]);

  const handleDownload = (imageUrl: string, originalFileName: string) => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    const originalName = originalFileName.split('.')[0] || 'image';
    const extension = settings.outputFormat.split('/')[1].replace('jpeg', 'jpg');
    link.download = `${originalName}_edited.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    const editedImages = images.filter(img => img.editedUrl);

    if (editedImages.length === 0) return;

    for (const image of editedImages) {
        const response = await fetch(image.editedUrl!);
        const blob = await response.blob();
        const originalName = image.originalFileName.split('.')[0] || 'image';
        const extension = settings.outputFormat.split('/')[1].replace('jpeg', 'jpg');
        const filename = `${originalName}_edited.${extension}`;
        zip.file(filename, blob);
    }

    zip.generateAsync({ type: 'blob' }).then((content: Blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `edited_images_${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    });
  };
  
  const getButtonText = () => {
    if (isProcessing) {
        return `Processing... (${progress.current}/${progress.total})`;
    }
    const count = selectedImageIds.size;
    if (count === 0) {
        return 'Select Images to Edit';
    }
    return `Apply Edits to ${count} Selected Image(s)`;
  };
  
  const successfullyEditedCount = images.filter(img => img.editedUrl).length;

  return (
    <div className="w-full flex-grow flex flex-col items-center justify-center p-4">
      {images.length === 0 ? (
        <ImageUpload onImageSelect={handleImageSelect} multiple={true} />
      ) : (
        <div className="w-full max-w-7xl mx-auto flex flex-col items-center">
          <div className="w-full p-6 bg-gray-800/50 rounded-xl border border-gray-700 mb-8 sticky top-4 z-10 backdrop-blur-sm">
             {/* Simple Prompt for now, a full settings panel would go here */}
             <div>
                <label htmlFor="userPrompt" className="block font-semibold text-gray-300 mb-2">Editing Prompt</label>
                <textarea
                    id="userPrompt"
                    value={settings.userPrompt}
                    onChange={(e) => setSettings(s => ({...s, userPrompt: e.target.value}))}
                    disabled={isProcessing}
                    rows={2}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-teal-500 focus:border-teal-500"
                    placeholder="e.g., Make the image look more vibrant and dramatic."
                />
            </div>

            {/* Rotation Section */}
            <div className="mt-4 pt-4 border-t border-gray-700">
                <h3 className="font-semibold text-gray-300 mb-3">Rotation</h3>
                <div className="flex items-center space-x-4">
                    <input
                        type="range"
                        min="-180"
                        max="180"
                        value={settings.rotationAngle}
                        onChange={(e) => setSettings(s => ({ ...s, rotationAngle: parseInt(e.target.value) }))}
                        disabled={isProcessing}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                    />
                    <div className="relative">
                        <input
                            type="number"
                            min="-180"
                            max="180"
                            value={settings.rotationAngle}
                            onChange={(e) => setSettings(s => ({ ...s, rotationAngle: parseInt(e.target.value) || 0 }))}
                            disabled={isProcessing}
                            className="w-24 bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-center focus:ring-teal-500 focus:border-teal-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">°</span>
                    </div>
                    <button
                        onClick={() => setSettings(s => ({ ...s, rotationAngle: 0 }))}
                        disabled={isProcessing || settings.rotationAngle === 0}
                        className="p-2 bg-gray-600 hover:bg-gray-500 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Reset Rotation"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
            
            {/* Crop Options Section */}
            <div className="mt-4 pt-4 border-t border-gray-700">
                <h3 className="font-semibold text-gray-300 mb-3">Crop Options</h3>
                <div className="flex items-center space-x-4 mb-4">
                    <label htmlFor="cropEnabled" className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input
                                type="checkbox"
                                id="cropEnabled"
                                className="sr-only"
                                checked={settings.cropConfig.enabled}
                                onChange={(e) => setSettings(s => ({ ...s, cropConfig: { ...s.cropConfig, enabled: e.target.checked } }))}
                                disabled={isProcessing}
                            />
                            <div className={`block w-14 h-8 rounded-full ${settings.cropConfig.enabled ? 'bg-teal-500' : 'bg-gray-600'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.cropConfig.enabled ? 'transform translate-x-6' : ''}`}></div>
                        </div>
                        <div className="ml-3 text-white font-medium">
                            {settings.cropConfig.enabled ? 'Enabled' : 'Disabled'}
                        </div>
                    </label>
                </div>

                <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 transition-opacity duration-300 ${settings.cropConfig.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <div>
                        <label htmlFor="cropX" className="block text-sm font-medium text-gray-400 mb-1">X Offset (%)</label>
                        <input
                            type="number"
                            id="cropX"
                            min="0"
                            max="100"
                            value={settings.cropConfig.x}
                            onChange={(e) => setSettings(s => ({ ...s, cropConfig: { ...s.cropConfig, x: parseInt(e.target.value) || 0 } }))}
                            disabled={!settings.cropConfig.enabled || isProcessing}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-teal-500 focus:border-teal-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="cropY" className="block text-sm font-medium text-gray-400 mb-1">Y Offset (%)</label>
                        <input
                            type="number"
                            id="cropY"
                            min="0"
                            max="100"
                            value={settings.cropConfig.y}
                            onChange={(e) => setSettings(s => ({ ...s, cropConfig: { ...s.cropConfig, y: parseInt(e.target.value) || 0 } }))}
                            disabled={!settings.cropConfig.enabled || isProcessing}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-teal-500 focus:border-teal-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="cropWidth" className="block text-sm font-medium text-gray-400 mb-1">Width (%)</label>
                        <input
                            type="number"
                            id="cropWidth"
                            min="0"
                            max="100"
                            value={settings.cropConfig.width}
                            onChange={(e) => setSettings(s => ({ ...s, cropConfig: { ...s.cropConfig, width: parseInt(e.target.value) || 0 } }))}
                            disabled={!settings.cropConfig.enabled || isProcessing}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-teal-500 focus:border-teal-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="cropHeight" className="block text-sm font-medium text-gray-400 mb-1">Height (%)</label>
                        <input
                            type="number"
                            id="cropHeight"
                            min="0"
                            max="100"
                            value={settings.cropConfig.height}
                            onChange={(e) => setSettings(s => ({ ...s, cropConfig: { ...s.cropConfig, height: parseInt(e.target.value) || 0 } }))}
                            disabled={!settings.cropConfig.enabled || isProcessing}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-teal-500 focus:border-teal-500"
                        />
                    </div>
                </div>
            </div>

            {/* Grayscale Filter Section */}
            <div className="mt-4 pt-4 border-t border-gray-700">
                <h3 className="font-semibold text-gray-300 mb-3">Grayscale Filter</h3>
                <div className="flex items-center space-x-4 mb-4">
                    <label htmlFor="grayscaleEnabled" className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input
                                type="checkbox"
                                id="grayscaleEnabled"
                                className="sr-only"
                                checked={settings.filterConfig.grayscale.enabled}
                                onChange={(e) => setSettings(s => ({ ...s, filterConfig: { ...s.filterConfig, grayscale: { ...s.filterConfig.grayscale, enabled: e.target.checked } } }))}
                                disabled={isProcessing}
                            />
                            <div className={`block w-14 h-8 rounded-full ${settings.filterConfig.grayscale.enabled ? 'bg-teal-500' : 'bg-gray-600'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.filterConfig.grayscale.enabled ? 'transform translate-x-6' : ''}`}></div>
                        </div>
                        <div className="ml-3 text-white font-medium">
                            {settings.filterConfig.grayscale.enabled ? 'Enabled' : 'Disabled'}
                        </div>
                    </label>
                </div>

                <div className={`flex items-center space-x-4 transition-opacity duration-300 ${settings.filterConfig.grayscale.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <label htmlFor="grayscaleIntensity" className="text-sm font-medium text-gray-400">Intensity</label>
                    <input
                        type="range"
                        id="grayscaleIntensity"
                        min="0"
                        max="100"
                        value={settings.filterConfig.grayscale.intensity}
                        onChange={(e) => setSettings(s => ({ ...s, filterConfig: { ...s.filterConfig, grayscale: { ...s.filterConfig.grayscale, intensity: parseInt(e.target.value) } } }))}
                        disabled={!settings.filterConfig.grayscale.enabled || isProcessing}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                    />
                    <div className="relative">
                        <input
                            type="number"
                            min="0"
                            max="100"
                            value={settings.filterConfig.grayscale.intensity}
                            onChange={(e) => setSettings(s => ({ ...s, filterConfig: { ...s.filterConfig, grayscale: { ...s.filterConfig.grayscale, intensity: parseInt(e.target.value) || 0 } } }))}
                            disabled={!settings.filterConfig.grayscale.enabled || isProcessing}
                            className="w-20 bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-center focus:ring-teal-500 focus:border-teal-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                    </div>
                </div>
            </div>

            {/* Brightness Adjustment Section */}
            <div className="mt-4 pt-4 border-t border-gray-700">
                <h3 className="font-semibold text-gray-300 mb-3">Brightness</h3>
                <div className="flex items-center space-x-4">
                    <input
                        type="range"
                        min="0"
                        max="200"
                        value={settings.filterConfig.brightness}
                        onChange={(e) => setSettings(s => ({ ...s, filterConfig: { ...s.filterConfig, brightness: parseInt(e.target.value) } }))}
                        disabled={isProcessing}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                    />
                    <div className="relative">
                        <input
                            type="number"
                            min="0"
                            max="200"
                            value={settings.filterConfig.brightness}
                            onChange={(e) => setSettings(s => ({ ...s, filterConfig: { ...s.filterConfig, brightness: parseInt(e.target.value) || 100 } }))}
                            disabled={isProcessing}
                            className="w-24 bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-center focus:ring-teal-500 focus:border-teal-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                    </div>
                    <button
                        onClick={() => setSettings(s => ({ ...s, filterConfig: { ...s.filterConfig, brightness: 100 } }))}
                        disabled={isProcessing || settings.filterConfig.brightness === 100}
                        className="p-2 bg-gray-600 hover:bg-gray-500 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Reset Brightness"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Contrast Adjustment Section */}
            <div className="mt-4 pt-4 border-t border-gray-700">
                <h3 className="font-semibold text-gray-300 mb-3">Contrast</h3>
                <div className="flex items-center space-x-4">
                    <input
                        type="range"
                        min="0"
                        max="200"
                        value={settings.filterConfig.contrast}
                        onChange={(e) => setSettings(s => ({ ...s, filterConfig: { ...s.filterConfig, contrast: parseInt(e.target.value) } }))}
                        disabled={isProcessing}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                    />
                    <div className="relative">
                        <input
                            type="number"
                            min="0"
                            max="200"
                            value={settings.filterConfig.contrast}
                            onChange={(e) => setSettings(s => ({ ...s, filterConfig: { ...s.filterConfig, contrast: parseInt(e.target.value) || 100 } }))}
                            disabled={isProcessing}
                            className="w-24 bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-center focus:ring-teal-500 focus:border-teal-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                    </div>
                    <button
                        onClick={() => setSettings(s => ({ ...s, filterConfig: { ...s.filterConfig, contrast: 100 } }))}
                        disabled={isProcessing || settings.filterConfig.contrast === 100}
                        className="p-2 bg-gray-600 hover:bg-gray-500 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Reset Contrast"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Resize Options Section */}
            <div className="mt-4 pt-4 border-t border-gray-700">
                <h3 className="font-semibold text-gray-300 mb-3">Resize Options</h3>
                <div className="flex items-center space-x-4 mb-4">
                    <label htmlFor="resizeEnabled" className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input
                                type="checkbox"
                                id="resizeEnabled"
                                className="sr-only"
                                checked={settings.resizeConfig.enabled}
                                onChange={(e) => setSettings(s => ({ ...s, resizeConfig: { ...s.resizeConfig, enabled: e.target.checked } }))}
                                disabled={isProcessing}
                            />
                            <div className={`block w-14 h-8 rounded-full ${settings.resizeConfig.enabled ? 'bg-teal-500' : 'bg-gray-600'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.resizeConfig.enabled ? 'transform translate-x-6' : ''}`}></div>
                        </div>
                        <div className="ml-3 text-white font-medium">
                            {settings.resizeConfig.enabled ? 'Enabled' : 'Disabled'}
                        </div>
                    </label>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 transition-opacity duration-300 ${settings.resizeConfig.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <div>
                        <label htmlFor="resizeWidth" className="block text-sm font-medium text-gray-400 mb-1">Width (px)</label>
                        <input
                            type="number"
                            id="resizeWidth"
                            value={settings.resizeConfig.width}
                            onChange={(e) => setSettings(s => ({ ...s, resizeConfig: { ...s.resizeConfig, width: parseInt(e.target.value) || 0 } }))}
                            disabled={!settings.resizeConfig.enabled || isProcessing}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-teal-500 focus:border-teal-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="resizeHeight" className="block text-sm font-medium text-gray-400 mb-1">Height (px)</label>
                        <input
                            type="number"
                            id="resizeHeight"
                            value={settings.resizeConfig.height}
                            onChange={(e) => setSettings(s => ({ ...s, resizeConfig: { ...s.resizeConfig, height: parseInt(e.target.value) || 0 } }))}
                            disabled={!settings.resizeConfig.enabled || isProcessing}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-teal-500 focus:border-teal-500"
                        />
                    </div>
                    <div className="flex items-end pb-1">
                         <label htmlFor="maintainAspectRatio" className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                id="maintainAspectRatio"
                                checked={settings.resizeConfig.maintainAspectRatio}
                                onChange={(e) => setSettings(s => ({ ...s, resizeConfig: { ...s.resizeConfig, maintainAspectRatio: e.target.checked } }))}
                                disabled={!settings.resizeConfig.enabled || isProcessing}
                                className="h-5 w-5 bg-gray-700 border-gray-500 text-teal-500 rounded focus:ring-teal-400 cursor-pointer"
                            />
                            <span className="ml-2 text-sm text-gray-300">Maintain Aspect Ratio</span>
                        </label>
                    </div>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700 flex flex-wrap justify-center items-center gap-4">
                <ActionButton onClick={handleGenerateEdits} disabled={isProcessing || selectedImageIds.size === 0}>
                    {getButtonText()}
                </ActionButton>
                {successfullyEditedCount > 0 && (
                    <ActionButton onClick={handleDownloadAll} variant="primary" disabled={isProcessing}>
                    Download All Edited (.zip)
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

          <div className="w-full flex justify-end mb-4 px-1">
              <button
                onClick={handleToggleSelectAll}
                className="text-sm font-semibold text-teal-400 hover:text-teal-300 disabled:opacity-50"
                disabled={isProcessing || images.length === 0}
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
          </div>

          <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {images.map(image => (
              <div 
                key={image.id} 
                className={`bg-gray-800 rounded-xl overflow-hidden shadow-lg border-2 flex flex-col transition-colors ${selectedImageIds.has(image.id) ? 'border-teal-500' : 'border-gray-700'}`}
              >
                <div className="relative w-full aspect-square">
                    {image.isLoading && (
                        <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center z-20">
                            <Spinner />
                        </div>
                    )}
                    <div 
                        className="absolute top-2 left-2 z-10 bg-gray-900/50 p-1 rounded-full flex items-center"
                    >
                        <input
                            type="checkbox"
                            checked={selectedImageIds.has(image.id)}
                            onChange={() => handleToggleSelection(image.id)}
                            className="form-checkbox h-5 w-5 bg-gray-700 border-gray-500 text-teal-500 rounded focus:ring-teal-400 cursor-pointer"
                            aria-label={`Select image ${image.originalFileName}`}
                        />
                    </div>
                    <button 
                        onClick={() => handleRemoveImage(image.id)} 
                        disabled={isProcessing}
                        className="absolute top-2 right-2 z-10 bg-gray-900/50 p-1.5 rounded-full text-white hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={`Remove image ${image.originalFileName}`}
                        title="Remove Image"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                    
                    <img src={image.originalDataUrl} alt={image.originalFileName} className="w-full h-full object-contain" />

                    {image.editedUrl && (
                        <img src={image.editedUrl} alt="Edited" className="absolute inset-0 w-full h-full object-contain opacity-0 hover:opacity-100 transition-opacity duration-300 z-10" />
                    )}
                </div>
                <div className="p-4 flex flex-col flex-grow">
                    <p className="text-sm text-gray-400 truncate" title={image.originalFileName}>{image.originalFileName}</p>
                    {image.error && <p className="text-xs text-red-400 mt-1">Error: {image.error}</p>}
                </div>
                {image.editedUrl && !image.isLoading && (
                    <div className="p-3 bg-gray-800/50 border-t border-gray-700">
                        <ActionButton onClick={() => handleDownload(image.editedUrl!, image.originalFileName)} className="w-full py-2">
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

export default EditorView;