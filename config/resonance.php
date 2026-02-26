<?php

return [
    /*
    |--------------------------------------------------------------------------
    | API Documentation
    |--------------------------------------------------------------------------
    |
    | Resonance integrates with Scramble to generate OpenAPI documentation.
    | Configure which API routes to document and where to serve the docs.
    |   api_path: Routes starting with this path will be documented
    |   docs_path: Where to serve the OpenAPI docs
    |   middleware: Middleware for docs routes
    |
    */
    'api_docs' => [
        'enabled' => env('RESONANCE_API_DOCS_ENABLED', true),
        'api_path' => 'api',
        'docs_path' => env('RESONANCE_DOCS_PATH', 'docs/api'),
        'middleware' => ['web'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Development Features
    |--------------------------------------------------------------------------
    |
    | Enable developer-friendly features during development. These are
    | automatically disabled in production.
    |   error_devtools: Show Whoops error pages in devtools plugin for 500+ errors
    |   debug_signals: Log signals to browser console
    |
    */
    'dev' => [
        'error_devtools' => env('RESONANCE_ERROR_DEVTOOLS', true),
        'debug_signals' => env('RESONANCE_DEBUG_SIGNALS', false),
    ],

    /*
    |--------------------------------------------------------------------------
    | Signal Configuration
    |--------------------------------------------------------------------------
    |
    | Configure how Resonance processes and delivers signals to the frontend.
    |   batch: Queue signals for batch delivery (reduces response overhead)
    |   handlers: Custom signal handlers (register your own signal types)
    |
    */
    'signals' => [
        'batch' => env('RESONANCE_BATCH_SIGNALS', true),
        'handlers' => [],
    ],
];
