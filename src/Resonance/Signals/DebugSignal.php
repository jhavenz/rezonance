<?php

namespace Jhavenz\Resonance\Signals;

use Jhavenz\Resonance\Contracts\Signal;

class DebugSignal implements Signal
{
    public function __construct(
        public readonly mixed $data,
        public readonly string $label = '',
    ) {}

    public function getType(): string
    {
        return 'debug';
    }

    public function toArray(): array
    {
        return [
            'type' => $this->getType(),
            'data' => $this->data,
            'label' => $this->label,
        ];
    }
}
