import React from 'react';
import { render } from 'ink';

import type { CliOptions } from './tui.cli.ts';
import type { AuraClient } from './client/client.ts';
import { createCli, parseCliOptions } from './tui.cli.ts';
import { createHttpClient } from './client/client.http.ts';
import { createStandaloneClient } from './client/client.standalone.ts';
import { App } from './tui.app.tsx';

const run = async (options: CliOptions): Promise<void> => {
  let client: AuraClient;
  let cleanup: (() => Promise<void>) | undefined;

  if (options.standalone) {
    console.log('Starting in standalone mode...');
    const configDir = options.config ?? process.env.AURA_CONFIG_DIR;
    const standalone = await createStandaloneClient({
      configDir,
    });
    client = standalone.client;
    cleanup = standalone.destroy;
    console.log('Standalone server initialized');
  } else {
    client = createHttpClient({ baseUrl: options.server });
  }

  const { waitUntilExit } = render(React.createElement(App, { client }));

  try {
    await waitUntilExit();
  } finally {
    if (cleanup) {
      await cleanup();
    }
  }
};

const main = async (): Promise<void> => {
  const program = createCli();
  program.parse();

  const options = parseCliOptions(program);

  try {
    await run(options);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
};

// Run if executed directly
main();

// Exports for programmatic use
export type { CliOptions };
export { createCli, parseCliOptions, run };
export { createHttpClient, HttpClientError } from './client/client.http.ts';
export { createStandaloneClient } from './client/client.standalone.ts';
export type { StandaloneClientConfig, StandaloneClientInstance } from './client/client.standalone.ts';
export type { AuraClient, AuraClientConfig, ListTicketsFilters, StreamEventHandler } from './client/client.ts';
export { App } from './tui.app.tsx';
export { AppProvider, useAppContext, useAppState, useAppDispatch, useClient } from './state/state.context.tsx';
export type { AppState, AppAction } from './state/state.ts';
export {
  initialState,
  appReducer,
  navigate,
  goBack,
  setTickets,
  setSelectedIndex,
  setCurrentTicket,
  updateTicket,
  setStepProgress,
  setLoading,
  setError,
  addToast,
  removeToast,
  showModal,
  hideModal,
  setFilters,
  setConnected,
} from './state/state.ts';
export { theme, statusColors, priorityColors, colors } from './theme/theme.ts';
export type { Theme, StatusColorMap, PriorityColorMap, ThemeColors } from './theme/theme.ts';
export type {
  ScreenName,
  ScreenParams,
  Screen,
  NavigationHistoryEntry,
  ToastType,
  Toast,
  ModalConfig,
  ListFilters,
  StreamEvent,
  StepProgress,
  UnsubscribeFn,
} from './tui.types.ts';
