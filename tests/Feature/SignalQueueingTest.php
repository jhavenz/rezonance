<?php

use Jhavenz\Resonance\ResonanceManager;
use Jhavenz\Resonance\Facades\Resonance;
use Jhavenz\Resonance\Signals\InvalidateSignal;
use Jhavenz\Resonance\Signals\FlashSignal;
use Jhavenz\Resonance\Signals\RedirectSignal;
use Jhavenz\Resonance\Signals\EventSignal;
use Jhavenz\Resonance\Signals\ErrorSignal;
use Jhavenz\Resonance\Signals\DebugSignal;
use Jhavenz\Resonance\Signals\TokenSignal;

it('queues invalidate signals with scope', function () {
    $manager = app(ResonanceManager::class);

    $manager->invalidate('posts', 'users');

    $signals = $manager->getSignals();
    expect($signals)->toHaveCount(1)
        ->and($signals[0])->toBeInstanceOf(InvalidateSignal::class)
        ->and($signals[0]->toArray())->toMatchArray([
            'type' => 'invalidate',
            'scope' => ['posts', 'users'],
        ]);
});

it('queues flash signals with message and variant', function () {
    $manager = app(ResonanceManager::class);

    $manager->flash('Profile updated!', 'success');

    $signals = $manager->getSignals();
    expect($signals)->toHaveCount(1)
        ->and($signals[0])->toBeInstanceOf(FlashSignal::class)
        ->and($signals[0]->toArray())->toMatchArray([
            'type' => 'flash',
            'message' => 'Profile updated!',
            'variant' => 'success',
        ]);
});

it('queues flash signals with default success variant', function () {
    $manager = app(ResonanceManager::class);

    $manager->flash('Done!');

    $signals = $manager->getSignals();
    expect($signals[0]->toArray()['variant'])->toBe('success');
});

it('queues redirect signals with path extraction from full URLs', function () {
    $manager = app(ResonanceManager::class);

    $manager->redirect('http://localhost:8000/dashboard/settings');

    $signals = $manager->getSignals();
    expect($signals)->toHaveCount(1)
        ->and($signals[0])->toBeInstanceOf(RedirectSignal::class)
        ->and($signals[0]->toArray())->toMatchArray([
            'type' => 'redirect',
            'to' => 'dashboard/settings', // Uri::of() strips leading slash
            'replace' => false,
        ]);
});

it('queues redirect signals with relative paths unchanged', function () {
    $manager = app(ResonanceManager::class);

    $manager->redirect('/login');

    $signals = $manager->getSignals();
    expect($signals[0]->toArray()['to'])->toBe('/login');
});

it('queues redirect signals with replace option', function () {
    $manager = app(ResonanceManager::class);

    $manager->redirect('/home', replace: true);

    $signals = $manager->getSignals();
    expect($signals[0]->toArray()['replace'])->toBeTrue();
});

it('queues event signals with name and payload', function () {
    $manager = app(ResonanceManager::class);

    $manager->event('user.created', ['id' => 123, 'name' => 'John']);

    $signals = $manager->getSignals();
    expect($signals)->toHaveCount(1)
        ->and($signals[0])->toBeInstanceOf(EventSignal::class)
        ->and($signals[0]->toArray())->toMatchArray([
            'type' => 'event',
            'name' => 'user.created',
            'payload' => ['id' => 123, 'name' => 'John'],
        ]);
});

it('queues event signals with null payload', function () {
    $manager = app(ResonanceManager::class);

    $manager->event('cache.cleared');

    $signals = $manager->getSignals();
    expect($signals[0]->toArray()['payload'])->toBeNull();
});

it('queues error signals with message and context', function () {
    $manager = app(ResonanceManager::class);

    $manager->error('Something went wrong', ['code' => 'E001']);

    $signals = $manager->getSignals();
    expect($signals)->toHaveCount(1)
        ->and($signals[0])->toBeInstanceOf(ErrorSignal::class)
        ->and($signals[0]->toArray())->toMatchArray([
            'type' => 'error',
            'message' => 'Something went wrong',
            'context' => ['code' => 'E001'],
        ]);
});

it('queues debug signals with data and label', function () {
    $manager = app(ResonanceManager::class);

    $manager->debug(['query' => 'SELECT * FROM users'], 'SQL Query');

    $signals = $manager->getSignals();
    expect($signals)->toHaveCount(1)
        ->and($signals[0])->toBeInstanceOf(DebugSignal::class)
        ->and($signals[0]->toArray())->toMatchArray([
            'type' => 'debug',
            'data' => ['query' => 'SELECT * FROM users'],
            'label' => 'SQL Query',
        ]);
});

it('queues token signals', function () {
    $manager = app(ResonanceManager::class);

    $manager->token('jwt-token-12345');

    $signals = $manager->getSignals();
    expect($signals)->toHaveCount(1)
        ->and($signals[0])->toBeInstanceOf(TokenSignal::class)
        ->and($signals[0]->toArray())->toMatchArray([
            'type' => 'token',
            'token' => 'jwt-token-12345',
        ]);
});

it('supports method chaining', function () {
    $manager = app(ResonanceManager::class);

    $result = $manager
        ->invalidate('posts')
        ->flash('Created!')
        ->redirect('/posts');

    expect($result)->toBeInstanceOf(ResonanceManager::class)
        ->and($manager->getSignals())->toHaveCount(3);
});

it('drains signals and clears the queue', function () {
    $manager = app(ResonanceManager::class);

    $manager->flash('Hello');
    $manager->invalidate('posts');

    $drained = $manager->drainSignals();

    expect($drained)->toHaveCount(2)
        ->and($manager->getSignals())->toHaveCount(0);
});

it('sorts signals by priority with redirect last', function () {
    $manager = app(ResonanceManager::class);

    // Queue in "wrong" order
    $manager->redirect('/home');
    $manager->flash('Done!');
    $manager->invalidate('posts');
    $manager->event('test');
    $manager->token('abc123');

    $drained = $manager->drainSignals();

    // Expected order: invalidate(0), token(1), flash(2), event(3), redirect(5)
    expect($drained[0]['type'])->toBe('invalidate')
        ->and($drained[1]['type'])->toBe('token')
        ->and($drained[2]['type'])->toBe('flash')
        ->and($drained[3]['type'])->toBe('event')
        ->and($drained[4]['type'])->toBe('redirect');
});

it('works via facade', function () {
    Resonance::invalidate('users');
    Resonance::flash('Welcome!');

    $manager = app(ResonanceManager::class);
    $signals = $manager->getSignals();

    expect($signals)->toHaveCount(2);
});

it('accepts custom signal implementations', function () {
    $manager = app(ResonanceManager::class);

    $customSignal = new class implements \Jhavenz\Resonance\Contracts\Signal {
        public function getType(): string
        {
            return 'custom';
        }

        public function toArray(): array
        {
            return ['type' => 'custom', 'foo' => 'bar'];
        }
    };

    $manager->signal($customSignal);

    $signals = $manager->getSignals();
    expect($signals)->toHaveCount(1)
        ->and($signals[0]->toArray())->toMatchArray([
            'type' => 'custom',
            'foo' => 'bar',
        ]);
});

it('maintains singleton state across multiple calls', function () {
    // First call
    Resonance::flash('First');

    // Second call - same request
    Resonance::invalidate('posts');

    $manager = app(ResonanceManager::class);
    expect($manager->getSignals())->toHaveCount(2);
});
