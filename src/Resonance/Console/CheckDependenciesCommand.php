<?php

namespace Jhavenz\Resonance\Console;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class CheckDependenciesCommand extends Command
{
    protected $signature = 'resonance:check-deps';
    protected $description = 'Check if Resonance JavaScript dependencies are installed';

    public function handle(): int
    {
        if (!File::exists(base_path('node_modules/@jhavenz/resonance'))) {
            $this->warn('Resonance JavaScript dependencies not installed');
            $this->newLine();
            $this->line('Install with:');
            $this->line('  npm install @jhavenz/resonance');
            $this->line('  # or: bun add @jhavenz/resonance');
            $this->newLine();
            $this->line('Then run: php artisan resonance:install');

            // Return SUCCESS to not block composer install
            return self::SUCCESS;
        }

        $this->info('All Resonance dependencies installed');
        return self::SUCCESS;
    }
}
