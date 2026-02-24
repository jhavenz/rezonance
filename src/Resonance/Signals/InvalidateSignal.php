<?php

namespace Jhavenz\Resonance\Signals;

use Jhavenz\Resonance\Contracts\Signal;

class InvalidateSignal implements Signal
{
    public function __construct(
        private array $scope
    ) {}

    public function getType(): string
    {
        return 'invalidate';
    }

    public function toArray(): array
    {
        return [
            'type' => $this->getType(),
            'scope' => $this->scope,
        ];
    }
}
