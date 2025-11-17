
import { GoogleGenAI, Modality } from "@google/genai";

const getQualityDescription = (q: number): string => {
    if (q <= 20) return "extremely aggressive visual compression, resulting in a very abstract image with minimal detail";
    if (q <= 40) return "heavy visual compression, creating a stylized version with significantly reduced detail";
    if (q <= 60) return "moderate visual compression, aiming for a balanced simplification of details and complexity";
    if (q <= 80) return "light visual compression, with a subtle reduction in detail while retaining most of the original's character";
    return "very light visual compression, with minimal simplification, retaining almost all original details";
};

const getDetailLevelDescription = (d: number): string => {
    if (d <= 20) return "minimal detail, focusing only on the main shapes and colors";
    if (d <= 40) return "low detail, abstracting smaller elements";
    if (d <= 60) return "moderate detail, retaining key textures and features";
    if (d <= 80) return "high detail, keeping most of the fine elements intact";
    return "original detail, aiming to preserve all visual information";
};

const getResolutionDescription = (resolution: string): string => {
    if (resolution === 'original') {
        return "";
    }
    const [width, height] = resolution.split('x');
    return ` Additionally, resize the image to fit within a ${width}x${height} bounding box, maintaining the original aspect ratio. Do not stretch, distort, or crop the image; instead, scale it down proportionally to fit inside these dimensions. The final image's largest dimension should not exceed the corresponding dimension of the bounding box.`;
};


export const compressImageWithGemini = async (
  base64ImageData: string,
  mimeType: string,
  outputFormat: 'image/png' | 'image/jpeg' | 'image/webp',
  quality: number,
  detailLevel: number,
  resolution: string
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const qualityDesc = getQualityDescription(quality);
    const detailDesc = getDetailLevelDescription(detailLevel);
    const resolutionDesc = getResolutionDescription(resolution);

    const prompt = `Visually compress this image. The goal is to achieve ${qualityDesc}. The desired level of detail is ${detailDesc}.${resolutionDesc} The output should be a visually simplified, stylized, or abstract version of the original. Do not add any new elements or change the core subject matter. Just reduce visual complexity based on these instructions.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { data: base64ImageData, mimeType: mimeType } },
                { text: prompt },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return `data:${outputFormat};base64,${part.inlineData.data}`;
        }
    }
    throw new Error('No image was generated.');
};


export type ResizeConfig = {
    enabled: boolean;
    width: number;
    height: number;
    maintainAspectRatio: boolean;
};

export type CropConfig = {
    enabled: boolean;
    x: number; // percentage from left
    y: number; // percentage from top
    width: number; // percentage
    height: number; // percentage
};

export type TextOverlayConfig = {
    enabled: boolean;
    content: string;
    font: string;
    size: number;
    color: string;
    positionX: number;
    positionY: number;
};

export type FilterConfig = {
    grayscale: {
        enabled: boolean;
        intensity: number; // 0 to 100
    };
    brightness: number; // percentage, 100 is normal
    contrast: number;   // percentage, 100 is normal
};

export type TransparencyConfig = {
    method: 'fill' | 'dither' | 'preserve';
    fillColor: string; // Hex color code, e.g., '#FFFFFF'
};

export type WatermarkConfig = {
    enabled: boolean;
    text: string;
    opacity: number; // 0 to 100
    scale: number; // percentage of image width
    color: string;
    position: 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
};


export const editImageWithGemini = async (
  base64ImageData: string,
  mimeType: string,
  userPrompt: string,
  outputFormat: 'image/png' | 'image/jpeg' | 'image/webp',
  outputQuality: number,
  resizeConfig: ResizeConfig,
  cropConfig: CropConfig,
  rotationAngle: number,
  textOverlayConfig: TextOverlayConfig,
  filterConfig: FilterConfig,
  transparencyConfig: TransparencyConfig,
  watermarkConfig: WatermarkConfig
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let finalPrompt = `Apply the following edits to the image. The user's primary request is: "${userPrompt}".`;

    if (rotationAngle !== 0) {
        finalPrompt += `\n\n--- ROTATION INSTRUCTIONS ---\nFirst, rotate the image by ${rotationAngle} degrees clockwise. All subsequent instructions should apply to the rotated image.`;
    }

    if (cropConfig.enabled) {
        finalPrompt += `\n\n--- CROP INSTRUCTIONS ---\nAfter any rotation, crop the image. The crop region is defined by the following percentages of the image dimensions:\n- Start X (from left): ${cropConfig.x}%\n- Start Y (from top): ${cropConfig.y}%\n- Crop Width: ${cropConfig.width}%\n- Crop Height: ${cropConfig.height}%\nAll subsequent instructions should be applied to this newly cropped image area.`;
    }

    const filterInstructions = [];
    if (filterConfig.grayscale.enabled) {
        filterInstructions.push(`apply a grayscale filter with an intensity of ${filterConfig.grayscale.intensity}%. A value of 100% results in a fully black and white image, while a lower value partially desaturates the image`);
    }

    if (filterConfig.brightness !== 100) {
        filterInstructions.push(`adjust the brightness to ${filterConfig.brightness}% of the original`);
    }
    if (filterConfig.contrast !== 100) {
        filterInstructions.push(`adjust the contrast to ${filterConfig.contrast}% of the original`);
    }

    if (filterInstructions.length > 0) {
        finalPrompt += `\n\n--- FILTER INSTRUCTIONS ---\nAfter cropping, but before resizing or adding text, apply these adjustments: ${filterInstructions.join('; ')}.`;
    }
    
    if (transparencyConfig.method === 'fill') {
        finalPrompt += `\n\n--- TRANSPARENCY HANDLING ---\nIf the original image contains transparent areas (alpha channel), fill these areas completely with the solid color ${transparencyConfig.fillColor}. This background color should be applied before any other elements like text overlays.`;
    } else if (transparencyConfig.method === 'dither') {
        finalPrompt += `\n\n--- TRANSPARENCY HANDLING ---\nIf the original image contains transparent areas, create a smooth, dithered transition to an opaque background. Avoid a solid color fill; instead, use a subtle pattern or blend to handle the transparency gracefully.`;
    } else { // 'preserve'
        finalPrompt += `\n\n--- TRANSPARENCY HANDLING ---\nPreserve any transparency (alpha channel) from the original image in the final output. The background must remain transparent.`;
    }

    if (watermarkConfig.enabled && watermarkConfig.text.trim()) {
        const positionDescriptions = {
            'top-left': 'in the top-left corner',
            'top-center': 'centered horizontally at the top',
            'top-right': 'in the top-right corner',
            'middle-left': 'centered vertically on the left edge',
            'center': 'in the absolute center',
            'middle-right': 'centered vertically on the right edge',
            'bottom-left': 'in the bottom-left corner',
            'bottom-center': 'centered horizontally at the bottom',
            'bottom-right': 'in the bottom-right corner'
        };
        
        finalPrompt += `\n\n--- WATERMARK INSTRUCTIONS ---\nAdd a text watermark with the following properties. This should be applied before resizing and before the main text overlay.\n- CONTENT: "${watermarkConfig.text.trim()}"\n- COLOR: Use the color ${watermarkConfig.color}.\n- FONT: Use a clean, sans-serif font.\n- SIZE: The watermark's width should be approximately ${watermarkConfig.scale}% of the image's total width.\n- OPACITY: The watermark should have an opacity of ${watermarkConfig.opacity}%.\n- POSITION: Place the watermark ${positionDescriptions[watermarkConfig.position]}. The watermark should be subtly blended and not obscure the main subject.`;
    }

    if (resizeConfig.enabled) {
        if (resizeConfig.maintainAspectRatio) {
            finalPrompt += `\n\n--- RESIZE INSTRUCTIONS ---\nAfter all other edits, resize the resulting image to fit within a ${resizeConfig.width}x${resizeConfig.height} bounding box. Maintain the aspect ratio of the edited image. Do not stretch, distort, or perform additional cropping to fit; instead, scale it down proportionally. The final image's largest dimension must not exceed the corresponding dimension of the bounding box.`;
        } else {
            finalPrompt += `\n\n--- RESIZE INSTRUCTIONS ---\nAfter all other edits, resize the resulting image to the exact dimensions of ${resizeConfig.width}px width and ${resizeConfig.height}px height. Stretch or squash the image as necessary to meet these exact dimensions.`;
        }
    }

    if (textOverlayConfig.enabled && textOverlayConfig.content.trim()) {
        finalPrompt += `\n\n--- TEXT OVERLAY INSTRUCTIONS ---\nAs the final step, after all other transformations, add text to the image with these exact properties:\n- CONTENT: "${textOverlayConfig.content.trim()}"\n- COLOR: Use the color ${textOverlayConfig.color}.\n- FONT: Use a font that looks like ${textOverlayConfig.font}.\n- SIZE: Make the font size proportional to ${textOverlayConfig.size} on a 1024px image.\n- POSITION: Center the text at ${textOverlayConfig.positionX}% from the left and ${textOverlayConfig.positionY}% from the top. Do not add any background or bounding box to the text.`;
    }

    if (outputFormat === 'image/jpeg' || outputFormat === 'image/webp') {
        finalPrompt += `\n\n--- OUTPUT FORMAT ---\nEncode the final image as ${outputFormat} with a quality setting of approximately ${outputQuality}/100.`;
    } else {
        finalPrompt += `\n\n--- OUTPUT FORMAT ---\nEncode the final image as lossless ${outputFormat}.`;
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { data: base64ImageData, mimeType: mimeType } },
                { text: finalPrompt },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return `data:${outputFormat};base64,${part.inlineData.data}`;
        }
    }
    throw new Error('No image was generated.');
};

export const upscaleImageWithGemini = async (
  base64ImageData: string,
  mimeType: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `Upscale this image. Enhance the resolution, add fine details, and improve sharpness. The goal is a higher-quality, more detailed version of the original image. Do not change the content or composition.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: base64ImageData, mimeType: mimeType } },
        { text: prompt },
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error('No upscaled image was generated.');
};
