<?php

namespace Jhavenz\Resonance\Signals;

use Jhavenz\Resonance\Contracts\Signal;

class FlashSignal implements Signal
{
    public function __construct(
        private string $message,
        private string $variant = 'success'
    ) {}

    public function getType(): string
    {
        return 'flash';
    }

    public function toArray(): array
    {
        return [
            'type' => $this->getType(),
            'message' => $this->message,
            'variant' => $this->variant,
        ];
    }
}
