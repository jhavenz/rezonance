<?php

namespace Jhavenz\Resonance\Signals;

use Jhavenz\Resonance\Contracts\Signal;

class RedirectSignal implements Signal
{
    public function __construct(
        private string $to,
        private bool $replace = false
    ) {}

    public function getType(): string
    {
        return 'redirect';
    }

    public function toArray(): array
    {
        return [
            'type' => $this->getType(),
            'to' => $this->to,
            'replace' => $this->replace,
        ];
    }
}
