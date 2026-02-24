<?php

namespace Jhavenz\Resonance\Signals;

use Jhavenz\Resonance\Contracts\Signal;

class ErrorSignal implements Signal
{
    public function __construct(
        public readonly string $message,
        public readonly array $context = [],
    ) {}

    public function getType(): string
    {
        return 'error';
    }

    public function toArray(): array
    {
        return [
            'type' => $this->getType(),
            'message' => $this->message,
            'context' => $this->context,
        ];
    }
}
