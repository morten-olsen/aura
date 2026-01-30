import React from 'react';
import { Box, Text } from 'ink';

import { useNavigation } from '../hooks/hook.navigation.ts';
import { useShortcuts } from '../hooks/hook.shortcuts.ts';
import { Header } from '../components/component.header.tsx';
import { Footer } from '../components/component.footer.tsx';
import { Section } from '../components/component.panel.tsx';
import { theme } from '../theme/theme.ts';

type ShortcutRow = {
  key: string;
  description: string;
};

type ShortcutSectionProps = {
  title: string;
  shortcuts: ShortcutRow[];
};

const ShortcutSection = ({ title, shortcuts }: ShortcutSectionProps): React.ReactElement => {
  return (
    <Section title={title} marginBottom={1}>
      <Box flexDirection="column">
        {shortcuts.map((shortcut) => (
          <Box key={shortcut.key}>
            <Box width={15}>
              <Text color={theme.colors.highlight} bold>
                {shortcut.key}
              </Text>
            </Box>
            <Text color={theme.colors.text}>{shortcut.description}</Text>
          </Box>
        ))}
      </Box>
    </Section>
  );
};

const globalShortcuts: ShortcutRow[] = [
  { key: 'q', description: 'Quit the application' },
  { key: '?', description: 'Show this help screen' },
  { key: 'Esc / b', description: 'Go back to previous screen' },
];

const dashboardShortcuts: ShortcutRow[] = [
  { key: '↑ / k', description: 'Move selection up' },
  { key: '↓ / j', description: 'Move selection down' },
  { key: 'Enter', description: 'View selected ticket' },
  { key: 'n', description: 'Create new ticket' },
  { key: 'r', description: 'Refresh ticket list' },
];

const ticketShortcuts: ShortcutRow[] = [
  { key: 's', description: 'Start agent on ticket (if draft/approved)' },
  { key: 'p', description: 'Approve plan (if pending approval)' },
  { key: 'y', description: 'Grant pending approval' },
  { key: 'n', description: 'Deny pending approval' },
  { key: 'a', description: 'Answer pending question' },
  { key: 'r', description: 'Refresh ticket details' },
];

const createShortcuts: ShortcutRow[] = [
  { key: 'Tab', description: 'Move to next field' },
  { key: '← / →', description: 'Change priority (when priority field active)' },
  { key: 'Ctrl+S', description: 'Submit the form' },
  { key: 'Esc', description: 'Cancel and go back' },
];

const HelpScreen = (): React.ReactElement => {
  const { navigateBack } = useNavigation();

  useShortcuts({
    escape: navigateBack,
    b: navigateBack,
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Header title="Aura" subtitle="Help" />

      <Box flexDirection="column" paddingX={1} marginTop={1} flexGrow={1}>
        <Box marginBottom={1}>
          <Text color={theme.colors.primary} bold>
            Aura TUI - Keyboard Reference
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text color={theme.colors.muted}>
            Aura is an AI-driven Kubernetes cluster management agent. Use this TUI to manage tickets, view agent
            progress, and approve actions.
          </Text>
        </Box>

        <ShortcutSection title="Global" shortcuts={globalShortcuts} />
        <ShortcutSection title="Dashboard" shortcuts={dashboardShortcuts} />
        <ShortcutSection title="Ticket Detail" shortcuts={ticketShortcuts} />
        <ShortcutSection title="Create Ticket" shortcuts={createShortcuts} />

        <Section title="Ticket Statuses" marginBottom={1}>
          <Box flexDirection="column">
            <Box>
              <Box width={18}>
                <Text color="gray">[DRAFT]</Text>
              </Box>
              <Text color={theme.colors.muted}>Initial state, not yet started</Text>
            </Box>
            <Box>
              <Box width={18}>
                <Text color="yellow">[PENDING APPROVAL]</Text>
              </Box>
              <Text color={theme.colors.muted}>Plan ready for review</Text>
            </Box>
            <Box>
              <Box width={18}>
                <Text color="cyan">[APPROVED]</Text>
              </Box>
              <Text color={theme.colors.muted}>Plan approved, ready to execute</Text>
            </Box>
            <Box>
              <Box width={18}>
                <Text color="blue">[IN PROGRESS]</Text>
              </Box>
              <Text color={theme.colors.muted}>Agent actively working</Text>
            </Box>
            <Box>
              <Box width={18}>
                <Text color="magenta">[AWAITING INPUT]</Text>
              </Box>
              <Text color={theme.colors.muted}>Agent needs user input</Text>
            </Box>
            <Box>
              <Box width={18}>
                <Text color="green">[COMPLETED]</Text>
              </Box>
              <Text color={theme.colors.muted}>Successfully finished</Text>
            </Box>
            <Box>
              <Box width={18}>
                <Text color="red">[FAILED]</Text>
              </Box>
              <Text color={theme.colors.muted}>Execution failed</Text>
            </Box>
          </Box>
        </Section>

        <Section title="Modes">
          <Box flexDirection="column">
            <Box>
              <Box width={15}>
                <Text color={theme.colors.highlight}>Client</Text>
              </Box>
              <Text color={theme.colors.muted}>Connect to running Aura server (default)</Text>
            </Box>
            <Box>
              <Box width={15}>
                <Text color={theme.colors.highlight}>Standalone</Text>
              </Box>
              <Text color={theme.colors.muted}>Run embedded server (--standalone)</Text>
            </Box>
          </Box>
        </Section>
      </Box>

      <Footer
        shortcuts={[
          { key: 'Esc/b', label: 'Back' },
          { key: 'q', label: 'Quit' },
        ]}
      />
    </Box>
  );
};

export { HelpScreen };
