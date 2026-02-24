<?php

namespace Jhavenz\Resonance\Facades;

use Illuminate\Support\Facades\Facade;

/**
 * @method static \Jhavenz\Resonance\ResonanceManager invalidate(string ...$keys)
 * @method static \Jhavenz\Resonance\ResonanceManager flash(string $message, string $variant = 'success')
 * @method static \Jhavenz\Resonance\ResonanceManager redirect(string $to, bool $replace = false)
 * @method static \Jhavenz\Resonance\ResonanceManager back()
 * @method static \Jhavenz\Resonance\ResonanceManager event(string $name, mixed $payload = null)
 * @method static \Jhavenz\Resonance\ResonanceManager signal(\Jhavenz\Resonance\Contracts\Signal $signal)
 * @method static \Illuminate\Http\JsonResponse response(mixed $data = null)
 *
 * @see \Jhavenz\Resonance\ResonanceManager
 */
class Resonance extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return \Jhavenz\Resonance\ResonanceManager::class;
    }
}
