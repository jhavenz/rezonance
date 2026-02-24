<?php

namespace Jhavenz\Resonance;

use Symfony\Component\HttpFoundation\StreamedResponse;

class StreamHelper
{
    public static function create(callable $callback): StreamedResponse
    {
        return new StreamedResponse(function () use ($callback) {
            // Auto-disable output buffering
            while (ob_get_level() > 0) {
                ob_end_flush();
            }

            $callback(new StreamWriter());
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}

class StreamWriter
{
    public function event(string $type, mixed $data): void
    {
        echo "event: {$type}\n";
        echo 'data: '.json_encode($data)."\n\n";
        flush();
    }

    public function text(string $text): void
    {
        $this->event('text', ['text' => $text]);
    }

    public function done(): void
    {
        $this->event('done', []);
    }

    public function error(string $message): void
    {
        $this->event('error', ['error' => $message]);
        $this->done();
    }
}
