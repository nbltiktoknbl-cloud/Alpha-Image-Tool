import React from 'react';

interface ToolSelectorProps {
  activeTool: 'compressor' | 'editor' | 'upscaler';
  setActiveTool: (tool: 'compressor' | 'editor' | 'upscaler') => void;
}

const tools = [
  { id: 'compressor', name: 'Visual Compressor' },
  { id: 'editor', name: 'AI Editor' },
  { id: 'upscaler', name: 'AI Upscaler' },
];

const ToolSelector: React.FC<ToolSelectorProps> = ({ activeTool, setActiveTool }) => {
  return (
    <div className="flex justify-center mb-8">
      <div className="flex p-1 space-x-1 bg-gray-800 rounded-xl">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id as 'compressor' | 'editor' | 'upscaler')}
            className={`w-full px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors duration-200 focus:outline-none ${
              activeTool === tool.id
                ? 'bg-teal-500 shadow'
                : 'hover:bg-gray-700'
            }`}
          >
            {tool.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ToolSelector;