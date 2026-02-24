<?php

namespace Jhavenz\Resonance\Contracts;

interface Signal
{
    public function getType(): string;

    public function toArray(): array;
}
