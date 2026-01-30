import React, { createContext, useContext, useReducer, useMemo } from 'react';

import type { AuraClient } from '../client/client.ts';

import type { AppState, AppAction } from './state.ts';
import { initialState, appReducer } from './state.ts';

type AppContextValue = {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  client: AuraClient;
};

const AppContext = createContext<AppContextValue | null>(null);

type AppProviderProps = {
  client: AuraClient;
  children: React.ReactNode;
};

const AppProvider = ({ client, children }: AppProviderProps): React.ReactElement => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const value = useMemo(() => ({ state, dispatch, client }), [state, client]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

const useAppContext = (): AppContextValue => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

const useAppState = (): AppState => {
  const { state } = useAppContext();
  return state;
};

const useAppDispatch = (): React.Dispatch<AppAction> => {
  const { dispatch } = useAppContext();
  return dispatch;
};

const useClient = (): AuraClient => {
  const { client } = useAppContext();
  return client;
};

export type { AppContextValue, AppProviderProps };
export { AppContext, AppProvider, useAppContext, useAppState, useAppDispatch, useClient };
