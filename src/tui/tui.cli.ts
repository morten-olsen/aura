import { Command } from 'commander';

type CliOptions = {
  server: string;
  standalone: boolean;
  config?: string;
};

const createCli = (): Command => {
  const program = new Command();

  program.name('aura').description('Aura TUI - AI-driven Kubernetes cluster management').version('1.0.0');

  program
    .option('-s, --server <url>', 'Aura server URL', 'http://localhost:3000')
    .option('--standalone', 'Run in standalone mode (embedded server)', false)
    .option('-c, --config <dir>', 'Configuration directory (standalone mode)');

  return program;
};

const parseCliOptions = (program: Command): CliOptions => {
  const opts = program.opts();
  return {
    server: opts.server as string,
    standalone: opts.standalone as boolean,
    config: opts.config as string | undefined,
  };
};

export type { CliOptions };
export { createCli, parseCliOptions };
