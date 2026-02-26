<?php

namespace Jhavenz\Resonance;

use Illuminate\Support\ServiceProvider;
use Jhavenz\Resonance\Console\CheckDependenciesCommand;
use Jhavenz\Resonance\Console\DevCommand;
use Jhavenz\Resonance\Console\GenerateCommand;
use Jhavenz\Resonance\Console\InstallCommand;

class ResonanceServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(
            __DIR__ . '/../../config/resonance.php',
            'resonance'
        );

        $this->app->singleton(ResonanceManager::class);
    }

    public function boot(): void
    {
        // Register middleware alias
        $this->app['router']->aliasMiddleware(
            'resonance',
            \Jhavenz\Resonance\Middleware\TransformResponse::class
        );

        // Publishable assets
        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__ . '/../../config/resonance.php' => config_path('resonance.php'),
            ], 'resonance-config');

            $this->commands([
                CheckDependenciesCommand::class,
                DevCommand::class,
                GenerateCommand::class,
                InstallCommand::class,
            ]);
        }

        // Register Scramble API documentation
        if (config('resonance.api_docs.enabled') && class_exists(\Dedoc\Scramble\Scramble::class)) {
            \Dedoc\Scramble\Scramble::registerApi('default', [
                'api_path' => config('resonance.api_docs.api_path'),
                'api_domain' => null,
            ]);

            // Register Scramble documentation routes with middleware
            \Dedoc\Scramble\Scramble::registerUiRoute(
                path: config('resonance.api_docs.docs_path'),
                api: 'default'
            )->middleware(config('resonance.api_docs.middleware', ['web']));

            \Dedoc\Scramble\Scramble::registerJsonSpecificationRoute(
                path: config('resonance.api_docs.docs_path'),
                api: 'default'
            );
        }
    }
}
