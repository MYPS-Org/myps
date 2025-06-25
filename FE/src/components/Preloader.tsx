
import React, { useState, useEffect } from 'react';
import { httpClient, type PreloaderState } from '../services/httpClient';

const Preloader: React.FC = () => {
  const [preloaderState, setPreloaderState] = useState<PreloaderState>({
    loading: false,
    progress: 0,
    message: "Processing Request"
  });

  useEffect(() => {
    const handlePreloaderChange = (state: PreloaderState) => {
      setPreloaderState(state);
    };

    httpClient.addPreloaderCallback(handlePreloaderChange);

    return () => {
      httpClient.removePreloaderCallback(handlePreloaderChange);
    };
  }, []);

  if (!preloaderState.loading) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm mx-4">
        <div className="relative">
          <svg 
            className="h-8 w-8 animate-spin text-blue-600" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            strokeWidth="1.5" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" 
            />
          </svg>
          <div className="absolute inset-0 h-8 w-8 border-2 border-blue-100 rounded-full animate-pulse" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {preloaderState.message || "Processing Request"}
          </h3>
          <p className="text-sm text-gray-600">
            {preloaderState.progress < 100 
              ? "Please wait while we handle your request..." 
              : "Almost done..."}
          </p>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300 ease-out" 
            style={{ width: `${preloaderState.progress}%` }} 
          />
        </div>
      </div>
    </div>
  );
};

export default Preloader;
