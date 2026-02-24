<?php

namespace Jhavenz\Resonance;

use Jhavenz\Resonance\Contracts\Signal;
use Jhavenz\Resonance\Signals\DebugSignal;
use Jhavenz\Resonance\Signals\ErrorSignal;
use Jhavenz\Resonance\Signals\EventSignal;
use Jhavenz\Resonance\Signals\FlashSignal;
use Jhavenz\Resonance\Signals\InvalidateSignal;
use Jhavenz\Resonance\Signals\RedirectSignal;
use Jhavenz\Resonance\Signals\TokenSignal;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;
use Illuminate\Support\Uri;

class ResonanceManager
{
    /** @var Signal[] */
    private array $signals = [];

    public function __construct()
    {
        // No dependencies - manager is request-scoped state holder
    }

    public function invalidate(string ...$keys): self
    {
        $this->pushSignal(new InvalidateSignal($keys));
        return $this;
    }

    public function flash(string $message, string $variant = 'success'): self
    {
        $this->pushSignal(new FlashSignal($message, $variant));
        return $this;
    }

    public function redirect(string $to, bool $replace = false): self
    {
        // Extract path from full URLs for SPA compatibility using Laravel Uri helper
        if (filter_var($to, FILTER_VALIDATE_URL)) {
            $to = Uri::of($to)->path();
        }

        $this->pushSignal(new RedirectSignal($to, $replace));
        return $this;
    }

    public function back(): self
    {
        return $this->redirect(url()->previous());
    }

    public function event(string $name, mixed $payload = null): self
    {
        $this->pushSignal(new EventSignal($name, $payload));
        return $this;
    }

    public function error(string $message, array $context = []): self
    {
        $this->pushSignal(new ErrorSignal($message, $context));
        return $this;
    }

    public function debug(mixed $data, string $label = ''): self
    {
        $this->pushSignal(new DebugSignal($data, $label));
        return $this;
    }

    public function token(?string $token): self
    {
        $this->pushSignal(new TokenSignal($token));
        return $this;
    }

    public function signal(Signal $signal): self
    {
        $this->pushSignal($signal);

        return $this;
    }

    public function response(mixed $data = null, int $status = 200): JsonResponse
    {
        return response()->json([
            'data' => $data,
            'meta' => [
                'signals' => $this->drainSignals(),
                'timestamp' => now()->getTimestampMs(),
                'trace_id' => (string) Str::ulid(),
            ],
        ], $status);
    }

    public function getSignals(): array
    {
        return $this->signals;
    }

    public function drainSignals(): array
    {
        usort($this->signals, fn (Signal $a, Signal $b) =>
            $this->getSignalPriority($a) <=> $this->getSignalPriority($b)
        );

        $signals = array_map(fn (Signal $s) => $s->toArray(), $this->signals);
        $this->signals = [];

        return $signals;
    }

    private function getSignalPriority(Signal $signal): int
    {
        return match ($signal->getType()) {
            'invalidate' => 0,
            'token' => 1,
            'flash' => 2,
            'event' => 3,
            'error', 'debug' => 4,
            'redirect' => 5,  // Always last
            default => 99,
        };
    }

    private function pushSignal(Signal $signal): void
    {
        $this->signals[] = $signal;
    }
}
