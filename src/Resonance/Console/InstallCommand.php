<?php

namespace Jhavenz\Resonance\Console;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class InstallCommand extends Command
{
    protected $signature = 'resonance:install
                            {--force : Overwrite existing files}';

    protected $description = 'Install Resonance Framework';

    public function handle(): int
    {
        $this->info('Installing Resonance Framework...');

        // Check JavaScript dependencies FIRST
        if (!File::exists(base_path('node_modules/@jhavenz/resonance'))) {
            $this->error('JavaScript dependencies not installed!');
            $this->newLine();
            $this->line('Install with one of:');
            $this->line('  npm install @jhavenz/resonance');
            $this->line('  bun add @jhavenz/resonance');
            $this->line('  pnpm add @jhavenz/resonance');
            $this->newLine();
            $this->line('Then run: php artisan resonance:install');
            return self::FAILURE;
        }

        // Publish config
        $this->call('vendor:publish', [
            '--tag' => 'resonance-config',
            '--force' => $this->option('force'),
        ]);

        // Publish Kubb config stub
        $this->publishKubbConfig();

        // Register middleware (just info message, auto-discovered)
        $this->info('Middleware "resonance" registered automatically');

        $this->newLine();
        $this->info('Resonance installed successfully!');
        $this->newLine();
        $this->info('Next steps:');
        $this->line('  1. Add Vite alias to vite.config.ts:');
        $this->line('     "@jhavenz/resonance": path.resolve(__dirname, "node_modules/@jhavenz/resonance/src/js")');
        $this->line('  2. Start dev server: php artisan resonance:dev');

        return self::SUCCESS;
    }

    protected function publishKubbConfig(): void
    {
        $stub = __DIR__ . '/../../../stubs/kubb.config.stub.ts';
        $target = base_path('kubb.config.ts');

        if (File::exists($target) && !$this->option('force')) {
            if (!$this->confirm('kubb.config.ts already exists. Overwrite?')) {
                return;
            }
        }

        // No more string replacement - stub now imports from library
        File::copy($stub, $target);

        $this->info('Published: kubb.config.ts');
    }
}
