<?php

namespace Jhavenz\Resonance\Console;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;

class GenerateCommand extends Command
{
    protected $signature = 'resonance:generate';

    protected $description = 'Generate TypeScript types and hooks from OpenAPI spec';

    public function handle(): int
    {
        // Check for npm package
        if (!File::exists(base_path('node_modules/@jhavenz/resonance'))) {
            $this->error('Resonance JavaScript package not found!');
            $this->line('Install with: npm install @jhavenz/resonance');
            return self::FAILURE;
        }

        $this->info('Generating TypeScript code from OpenAPI spec...');

        // Check Laravel is running
        if (!$this->isLaravelRunning()) {
            $this->error('Laravel dev server is not running.');
            $this->line('Start it with: php artisan serve');
            return self::FAILURE;
        }

        // Use npx to execute Kubb from @jhavenz/resonance package
        $result = Process::run('npx --package=@jhavenz/resonance resonance-generate generate');

        if ($result->failed()) {
            $this->error('Code generation failed:');
            $this->line($result->errorOutput());
            return self::FAILURE;
        }

        $this->line($result->output());

        // Run cleanup script to fix Kubb duplicate export bug
        $cleanup = Process::run('node packages/resonance/src/js/scripts/fix-kubb-duplicates.js');

        if ($cleanup->failed()) {
            $this->warn('Warning: Kubb duplicate export cleanup failed');
            $this->line($cleanup->errorOutput());
        } else {
            $this->line($cleanup->output());
        }

        $this->info('Code generation complete!');

        return self::SUCCESS;
    }

    protected function isLaravelRunning(): bool
    {
        $url = config('app.url') . '/up';

        try {
            $context = stream_context_create(['http' => ['timeout' => 2]]);
            $response = @file_get_contents($url, false, $context);
            return $response !== false;
        } catch (\Throwable) {
            return false;
        }
    }
}
