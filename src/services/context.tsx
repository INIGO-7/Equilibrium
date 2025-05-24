import React, { createContext, useContext, useState } from 'react';

interface ModelContextType {
  llamaContext: any;
  setLlamaContext: React.Dispatch<React.SetStateAction<any>>;
  isRAGReady: boolean;
  setIsRAGReady: React.Dispatch<React.SetStateAction<boolean>>;
}

const ModelContext = createContext<ModelContextType | null>(null);

export const useModel = () => useContext(ModelContext)!;

export const ModelProvider = ({ children }: any) => {
  const [llamaContext, setLlamaContext] = useState<any>(null);
  const [isRAGReady, setIsRAGReady] = useState(false);

  return (
    <ModelContext.Provider value={{ llamaContext, setLlamaContext, isRAGReady, setIsRAGReady }}>
      {children}
    </ModelContext.Provider>
  );
};
