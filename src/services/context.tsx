import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the context shape with TypeScript interface
export interface ModelContextType {
  llamaContext: any;
  setLlamaContext: React.Dispatch<React.SetStateAction<any>>;
  isRAGReady: boolean;
  setIsRAGReady: React.Dispatch<React.SetStateAction<boolean>>;
}

// Create context with explicit type and default null
const ModelContext = createContext<ModelContextType | null>(null);

// Custom hook to consume context, with non-null assertion
export const useModel = (): ModelContextType => {
  const context = useContext(ModelContext);
  if (!context) {
    throw new Error('useModel must be used within a ModelProvider');
  }
  return context;
};

// Define props for the provider
interface ModelProviderProps {
  children: ReactNode;
}

// Provider component with proper type annotations
export const ModelProvider: React.FC<ModelProviderProps> = ({ children }) => {
  const [llamaContext, setLlamaContext] = useState<any>(null);
  const [isRAGReady, setIsRAGReady] = useState<boolean>(false);

  return (
    <ModelContext.Provider
      value={{ llamaContext, setLlamaContext, isRAGReady, setIsRAGReady }}
    >
      {children}
    </ModelContext.Provider>
  );
};