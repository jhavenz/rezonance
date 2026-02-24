<?php

namespace Jhavenz\Resonance\Middleware;

use Jhavenz\Resonance\ResonanceManager;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class TransformResponse
{
    public function __construct(
        private ResonanceManager $manager
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Let errors (422, 500, etc.) pass through with standard HTTP semantics
        if (! $response->isSuccessful()) {
            return $response;
        }

        return $this->transformResponse($response);
    }

    private function transformResponse(Response $response): JsonResponse
    {
        // Handle redirects: Convert to Signal (prevents browser from following 302)
        if ($response instanceof RedirectResponse) {
            $this->manager->redirect($response->getTargetUrl());

            return $this->envelope(null);
        }

        // Handle JSON responses
        if ($response instanceof JsonResponse) {
            $data = $response->getData(true);

            // Skip wrapping if already a Resonance envelope (controller used Resonance::response())
            if ($this->isResonanceEnvelope($data)) {
                return $response;
            }

            return $this->envelope($data);
        }

        // Handle other responses (Resource, Collection, etc.)
        $data = $response->getContent();
        if (is_string($data) && $this->isJson($data)) {
            $data = json_decode($data, true);
        }

        return $this->envelope($data);
    }

    private function isResonanceEnvelope(mixed $data): bool
    {
        return is_array($data)
            && array_key_exists('data', $data)
            && array_key_exists('meta', $data)
            && is_array($data['meta'])
            && array_key_exists('signals', $data['meta']);
    }

    private function envelope(mixed $data): JsonResponse
    {
        return response()->json([
            'data' => $data,
            'meta' => [
                'signals' => $this->manager->drainSignals(),
                'timestamp' => now()->getTimestampMs(),
                'trace_id' => (string) Str::ulid(),
            ],
        ]);
    }

    private function isJson(string $string): bool
    {
        json_decode($string);

        return json_last_error() === JSON_ERROR_NONE;
    }
}
