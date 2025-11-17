import React, { useState } from 'react';
import CompressorView from './components/CompressorView';
import EditorView from './components/EditorView';
import ToolSelector from './components/ToolSelector';
import UpscalerView from './components/UpscalerView';


const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<'compressor' | 'editor' | 'upscaler'>('compressor');

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <header className="text-center my-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-cyan-500">
          Alpha Image Tools
        </h1>
        <p className="mt-2 text-lg text-gray-400">AI-Powered Visual Manipulation</p>
      </header>

      <ToolSelector activeTool={activeTool} setActiveTool={setActiveTool} />

      <main className="w-full flex-grow flex flex-col items-center justify-center">
        {activeTool === 'compressor' && <CompressorView />}
        {activeTool === 'editor' && <EditorView />}
        {activeTool === 'upscaler' && <UpscalerView />}
      </main>
      
      {/* About Section */}
      <section className="w-full max-w-4xl mx-auto my-12 p-8 bg-gray-800/50 rounded-xl border border-gray-700">
        <h2 className="text-3xl font-bold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-cyan-500">
          About Alpha Image Tools
        </h2>
        <p className="text-gray-300 mb-4">
          Alpha Image Tools is a comprehensive suite of AI-driven utilities designed to streamline your image manipulation workflow. Whether you're a designer, photographer, or content creator, our tools provide powerful features in a simple, intuitive interface.
        </p>
        <div className="mt-6">
          <h3 className="text-xl font-semibold text-gray-200 mb-3">Core Features:</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-400">
            <li>
              <span className="font-semibold text-teal-400">Visual Compressor:</span> Intelligently reduce file sizes by simplifying visual complexity, not just by discarding data. This is perfect for optimizing images for the web while maintaining artistic integrity.
            </li>
            <li>
              <span className="font-semibold text-teal-400">AI Editor:</span> Go beyond simple filters. Edit your images in batches using natural language prompts. Describe the changes you want, from altering colors and adding objects to completely transforming the scene.
            </li>
            <li>
              <span className="font-semibold text-teal-400">AI Upscaler:</span> Enhance the resolution of your images, adding detail and sharpness to create high-quality results from smaller sources.
            </li>
          </ul>
        </div>
        <p className="text-center text-gray-400 mt-8 text-sm">
          All of this is made possible by <span className="font-semibold text-white">Google's powerful and efficient Gemini API</span>, which allows for sophisticated, context-aware image generation and editing.
        </p>
      </section>

      <footer className="w-full text-center py-6 mt-auto">
        <p className="text-gray-500 text-sm">Powered by Google Gemini</p>
      </footer>
    </div>
  );
};

export default App;