import React, { useCallback } from 'react';

interface ImageUploadProps {
  onImageSelect: (files: File[]) => void;
  multiple?: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onImageSelect, multiple = true }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onImageSelect(Array.from(files));
    }
  };

  const onDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      // FIX: Explicitly type `file` as `File` to resolve TypeScript error.
      const imageFiles = Array.from(files).filter((file: File) => file.type.startsWith('image/'));
      if (imageFiles.length > 0) {
          if (multiple) {
            onImageSelect(imageFiles);
          } else {
            onImageSelect([imageFiles[0]]);
          }
      }
    }
  }, [onImageSelect, multiple]);
  
  const onDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <label 
        htmlFor="image-upload" 
        className="relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-800 border-gray-600 hover:border-teal-400 hover:bg-gray-700 transition-colors"
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <svg className="w-10 h-10 mb-4 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
          </svg>
          <p className="mb-2 text-sm text-gray-400"><span className="font-semibold text-teal-400">Click to upload {multiple ? 'files' : 'a file'}</span> or drag and drop</p>
          <p className="text-xs text-gray-500">PNG, JPG, or WEBP (MAX. 10MB)</p>
        </div>
        <input id="image-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} multiple={multiple} />
      </label>
    </div>
  );
};

export default ImageUpload;