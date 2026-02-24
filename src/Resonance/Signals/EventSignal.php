<?php

namespace Jhavenz\Resonance\Signals;

use Jhavenz\Resonance\Contracts\Signal;

class EventSignal implements Signal
{
    public function __construct(
        private string $name,
        private mixed $payload = null
    ) {}

    public function getType(): string
    {
        return 'event';
    }

    public function toArray(): array
    {
        return [
            'type' => $this->getType(),
            'name' => $this->name,
            'payload' => $this->payload,
        ];
    }
}
