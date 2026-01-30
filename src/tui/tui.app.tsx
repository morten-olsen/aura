import React from 'react';
import { Box, Text } from 'ink';

import type { AuraClient } from './client/client.ts';
import { AppProvider, useAppState } from './state/state.context.tsx';
import { useQuitShortcut } from './hooks/hook.shortcuts.ts';
import { DashboardScreen } from './screens/screen.dashboard.tsx';
import { TicketScreen } from './screens/screen.ticket.tsx';
import { CreateScreen } from './screens/screen.create.tsx';
import { HelpScreen } from './screens/screen.help.tsx';
import { ToastContainer } from './components/component.toast.tsx';
import { theme } from './theme/theme.ts';

const ScreenRouter = (): React.ReactElement => {
  const state = useAppState();

  switch (state.screen.name) {
    case 'dashboard':
      return <DashboardScreen />;
    case 'ticket':
      return <TicketScreen />;
    case 'create':
      return <CreateScreen />;
    case 'help':
      return <HelpScreen />;
    default:
      return (
        <Box padding={1}>
          <Text color={theme.colors.error}>Unknown screen: {state.screen.name}</Text>
        </Box>
      );
  }
};

const AppContent = (): React.ReactElement => {
  const state = useAppState();

  useQuitShortcut();

  return (
    <Box flexDirection="column" minHeight={20}>
      <ScreenRouter />
      {/* Global toast container for screens that don't have their own */}
      {state.screen.name === 'dashboard' && state.toasts.length > 0 && <ToastContainer toasts={state.toasts} />}
    </Box>
  );
};

type AppProps = {
  client: AuraClient;
};

const App = ({ client }: AppProps): React.ReactElement => {
  return (
    <AppProvider client={client}>
      <AppContent />
    </AppProvider>
  );
};

export type { AppProps };
export { App };
