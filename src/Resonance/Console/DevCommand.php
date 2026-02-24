<?php

namespace Jhavenz\Resonance\Console;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

class DevCommand extends Command
{
    protected $signature = 'resonance:dev
                            {--no-queue : Disable queue worker}
                            {--no-pail : Disable log streaming}
                            {--no-watch : Disable API file watching}';

    protected $description = 'Start Resonance development servers';

    private array $processes = [];

    public function handle(): int
    {
        // Check for npm package FIRST
        if (!File::exists(base_path('node_modules/@jhavenz/resonance'))) {
            $this->error('Resonance JavaScript package not found!');
            $this->line('Install with: npm install @jhavenz/resonance');
            return self::FAILURE;
        }

        $this->info('Starting Resonance development servers...');
        $this->newLine();

        // Start Laravel server
        $this->startLaravelServer();

        // Wait for Laravel to be ready
        if (!$this->waitForLaravel()) {
            $this->error('Laravel server failed to start');
            return self::FAILURE;
        }

        // Generate initial API types
        $this->info('Generating API client code...');
        $this->call('resonance:generate');

        // Start additional services
        $this->startVite();

        if (!$this->option('no-pail')) {
            $this->startPail();
        }

        if (!$this->option('no-watch')) {
            $this->startApiWatcher();
        }

        if (!$this->option('no-queue')) {
            $this->startQueue();
        }

        $this->newLine();
        $this->info('All services started successfully!');
        $this->line('   Server: http://localhost:' . (env('APP_PORT', 8880)));
        $this->line('   Vite: http://localhost:5173');
        $this->newLine();
        $this->line('Press Ctrl+C to stop all services');

        // Handle shutdown gracefully
        $this->trap([SIGTERM, SIGINT], function () {
            $this->info('Shutting down...');
            $this->stopAllProcesses();
        });

        // Wait for processes
        while (true) {
            sleep(1);
            $this->checkProcesses();
        }

        return self::SUCCESS;
    }

    private function startLaravelServer(): void
    {
        $port = env('APP_PORT', 8880);
        $process = Process::fromShellCommandline("php artisan serve --port={$port}");
        $process->setTimeout(null);
        $process->start();
        $this->processes['server'] = $process;
        $this->line('> Laravel server starting on port ' . $port);
    }

    private function waitForLaravel(int $timeout = 30): bool
    {
        $start = time();
        $url = config('app.url') . '/up';

        while (time() - $start < $timeout) {
            try {
                $context = stream_context_create(['http' => ['timeout' => 2]]);
                $response = @file_get_contents($url, false, $context);
                if ($response !== false) {
                    $this->line('[OK] Laravel server ready');
                    return true;
                }
            } catch (\Throwable) {
                // Continue waiting
            }
            usleep(500000); // 0.5 second
        }

        return false;
    }

    private function startVite(): void
    {
        $process = Process::fromShellCommandline('npm run dev');
        $process->setTimeout(null);
        $process->start();
        $this->processes['vite'] = $process;
        $this->line('> Vite dev server starting');
    }

    private function startPail(): void
    {
        $process = Process::fromShellCommandline('php artisan pail --timeout=0');
        $process->setTimeout(null);
        $process->start();
        $this->processes['pail'] = $process;
        $this->line('> Log streaming (pail) starting');
    }

    private function startApiWatcher(): void
    {
        // Watch for PHP file changes and regenerate API types
        $process = Process::fromShellCommandline(
            'php artisan resonance:watch'
        );
        $process->setTimeout(null);
        $process->start();
        $this->processes['api-watch'] = $process;
        $this->line('> API file watcher starting');
    }

    private function startQueue(): void
    {
        $process = Process::fromShellCommandline('php artisan queue:listen --tries=1');
        $process->setTimeout(null);
        $process->start();
        $this->processes['queue'] = $process;
        $this->line('> Queue worker starting');
    }

    private function checkProcesses(): void
    {
        foreach ($this->processes as $name => $process) {
            try {
                if ($process->isStarted() && !$process->isRunning()) {
                    $this->error("Process '{$name}' exited unexpectedly");
                    $this->stopAllProcesses();
                    exit(1);
                }
            } catch (\Throwable) {
                // Process resource invalid, consider it stopped
                $this->error("Process '{$name}' exited unexpectedly");
                $this->stopAllProcesses();
                exit(1);
            }
        }
    }

    private function stopAllProcesses(): void
    {
        foreach ($this->processes as $name => $process) {
            try {
                if ($process->isStarted() && $process->isRunning()) {
                    $process->stop(3, SIGTERM);
                    $this->line("Stopped: {$name}");
                }
            } catch (\Throwable) {
                // Process already stopped or resource invalid, ignore
            }
        }
    }
}
