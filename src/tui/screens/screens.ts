import type { ScreenName, Screen, ScreenParams } from '../tui.types.ts';

const createScreen = <T extends ScreenName>(name: T, params: ScreenParams[T]): Screen<T> => ({
  name,
  params,
});

const isDashboardScreen = (screen: Screen): screen is Screen<'dashboard'> => {
  return screen.name === 'dashboard';
};

const isTicketScreen = (screen: Screen): screen is Screen<'ticket'> => {
  return screen.name === 'ticket';
};

const isCreateScreen = (screen: Screen): screen is Screen<'create'> => {
  return screen.name === 'create';
};

const isHelpScreen = (screen: Screen): screen is Screen<'help'> => {
  return screen.name === 'help';
};

const getTicketIdFromScreen = (screen: Screen): string | null => {
  if (isTicketScreen(screen)) {
    return screen.params.ticketId;
  }
  return null;
};

export { createScreen, isDashboardScreen, isTicketScreen, isCreateScreen, isHelpScreen, getTicketIdFromScreen };
