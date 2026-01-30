import { useCallback } from 'react';

import { useAppDispatch, useAppState } from '../state/state.context.tsx';
import { navigate, goBack } from '../state/state.ts';
import type { ScreenName, Screen } from '../tui.types.ts';

type UseNavigationResult = {
  currentScreen: Screen;
  canGoBack: boolean;
  navigateTo: (name: ScreenName, params?: Record<string, unknown>) => void;
  navigateBack: () => void;
  navigateToDashboard: () => void;
  navigateToTicket: (ticketId: string) => void;
  navigateToCreate: () => void;
  navigateToHelp: () => void;
};

const useNavigation = (): UseNavigationResult => {
  const dispatch = useAppDispatch();
  const state = useAppState();

  const navigateTo = useCallback(
    (name: ScreenName, params: Record<string, unknown> = {}): void => {
      dispatch(navigate(name, params));
    },
    [dispatch],
  );

  const navigateBack = useCallback((): void => {
    dispatch(goBack());
  }, [dispatch]);

  const navigateToDashboard = useCallback((): void => {
    navigateTo('dashboard');
  }, [navigateTo]);

  const navigateToTicket = useCallback(
    (ticketId: string): void => {
      navigateTo('ticket', { ticketId });
    },
    [navigateTo],
  );

  const navigateToCreate = useCallback((): void => {
    navigateTo('create');
  }, [navigateTo]);

  const navigateToHelp = useCallback((): void => {
    navigateTo('help');
  }, [navigateTo]);

  return {
    currentScreen: state.screen,
    canGoBack: state.history.length > 0,
    navigateTo,
    navigateBack,
    navigateToDashboard,
    navigateToTicket,
    navigateToCreate,
    navigateToHelp,
  };
};

export type { UseNavigationResult };
export { useNavigation };
