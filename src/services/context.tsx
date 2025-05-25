import React, { createContext, useContext, useState } from 'react';

const ModelContext = createContext<any>(null);

export const useModel = () => useContext(ModelContext);

export const ModelProvider = ({ children }: any) => {
  const [context, setContext] = useState<any>(null);
  
  return (
    <ModelContext.Provider value={{ context, setContext }}>
      {children}
    </ModelContext.Provider>
  );
};;