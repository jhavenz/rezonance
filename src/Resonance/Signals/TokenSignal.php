<?php

namespace Jhavenz\Resonance\Signals;

use Jhavenz\Resonance\Contracts\Signal;

class TokenSignal implements Signal
{
    public function __construct(
        private ?string $token
    ) {}

    public function getType(): string
    {
        return 'token';
    }

    public function toArray(): array
    {
        return [
            'type' => $this->getType(),
            'token' => $this->token,
        ];
    }
}
