<?php

return [
    /*
    |--------------------------------------------------------------------------
    | API Documentation
    |--------------------------------------------------------------------------
    |
    | Resonance integrates with Scramble to generate OpenAPI documentation.
    | Configure which API routes to document and where to serve the docs.
    |
    */
    'api_docs' => [
        'enabled' => env('RESONANCE_API_DOCS_ENABLED', true),
        'api_path' => 'api',  // Routes starting with this path will be documented
        'docs_path' => env('RESONANCE_DOCS_PATH', 'docs/api'),  // Where to serve the OpenAPI docs
        'middleware' => ['web'],  // Middleware for docs routes
    ],

    /*
    |--------------------------------------------------------------------------
    | Development Features
    |--------------------------------------------------------------------------
    |
    | Enable developer-friendly features during development. These are
    | automatically disabled in production.
    |
    */
    'dev' => [
        // Show Whoops error pages in devtools plugin for 500+ errors
        'error_devtools' => env('RESONANCE_ERROR_DEVTOOLS', true),

        // Log signals to browser console
        'debug_signals' => env('RESONANCE_DEBUG_SIGNALS', false),
    ],

    /*
    |--------------------------------------------------------------------------
    | Signal Configuration
    |--------------------------------------------------------------------------
    |
    | Configure how Resonance processes and delivers signals to the frontend.
    |
    */
    'signals' => [
        // Queue signals for batch delivery (reduces response overhead)
        'batch' => env('RESONANCE_BATCH_SIGNALS', true),

        // Custom signal handlers (register your own signal types)
        'handlers' => [],
    ],
];
