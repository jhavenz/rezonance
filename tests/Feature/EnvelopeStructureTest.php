<?php

use Jhavenz\Resonance\ResonanceManager;
use Jhavenz\Resonance\Facades\Resonance;

it('creates response with correct envelope structure', function () {
    $manager = app(ResonanceManager::class);

    $response = $manager->response(['id' => 1, 'name' => 'Test']);

    expect($response->getStatusCode())->toBe(200);

    $content = $response->getData(true);

    expect($content)->toHaveKey('data')
        ->and($content)->toHaveKey('meta')
        ->and($content['data'])->toMatchArray(['id' => 1, 'name' => 'Test'])
        ->and($content['meta'])->toHaveKey('signals')
        ->and($content['meta'])->toHaveKey('timestamp')
        ->and($content['meta'])->toHaveKey('trace_id');
});

it('creates response with custom status code', function () {
    $manager = app(ResonanceManager::class);

    $response = $manager->response(['created' => true], 201);

    expect($response->getStatusCode())->toBe(201);
});

it('creates response with null data', function () {
    $manager = app(ResonanceManager::class);

    $response = $manager->response();

    $content = $response->getData(true);
    expect($content['data'])->toBeNull();
});

it('includes queued signals in response', function () {
    $manager = app(ResonanceManager::class);

    $manager->invalidate('posts', 'comments');
    $manager->flash('Saved!', 'success');

    $response = $manager->response(['saved' => true]);
    $content = $response->getData(true);

    expect($content['meta']['signals'])->toHaveCount(2);

    $invalidateSignal = collect($content['meta']['signals'])
        ->where('type', 'invalidate')
        ->first();

    expect($invalidateSignal)->toMatchArray([
        'type' => 'invalidate',
        'scope' => ['posts', 'comments'],
    ]);

    $flashSignal = collect($content['meta']['signals'])
        ->where('type', 'flash')
        ->first();

    expect($flashSignal)->toMatchArray([
        'type' => 'flash',
        'message' => 'Saved!',
        'variant' => 'success',
    ]);
});

it('drains signals after creating response', function () {
    $manager = app(ResonanceManager::class);

    $manager->flash('First');
    $manager->response(['data' => 'first']);

    // Signals should be drained
    expect($manager->getSignals())->toHaveCount(0);

    // Second response should not include first signals
    $manager->flash('Second');
    $response = $manager->response(['data' => 'second']);
    $content = $response->getData(true);

    expect($content['meta']['signals'])->toHaveCount(1)
        ->and($content['meta']['signals'][0]['message'])->toBe('Second');
});

it('generates ULID for trace_id', function () {
    $manager = app(ResonanceManager::class);

    $response = $manager->response();
    $content = $response->getData(true);

    $traceId = $content['meta']['trace_id'];

    // ULID is 26 characters, alphanumeric
    expect($traceId)->toBeString()
        ->and(strlen($traceId))->toBe(26)
        ->and($traceId)->toMatch('/^[0-9A-Z]+$/');
});

it('uses millisecond timestamp', function () {
    $before = now()->getTimestampMs();
    $manager = app(ResonanceManager::class);
    $response = $manager->response();
    $after = now()->getTimestampMs();

    $content = $response->getData(true);
    $timestamp = $content['meta']['timestamp'];

    expect($timestamp)->toBeInt()
        ->and($timestamp)->toBeGreaterThanOrEqual($before)
        ->and($timestamp)->toBeLessThanOrEqual($after);
});

it('works via facade response method', function () {
    Resonance::invalidate('tasks');
    $response = Resonance::response(['done' => true]);

    $content = $response->getData(true);

    expect($content['data'])->toMatchArray(['done' => true])
        ->and($content['meta']['signals'])->toHaveCount(1)
        ->and($content['meta']['signals'][0]['type'])->toBe('invalidate');
});

it('handles complex nested data structures', function () {
    $manager = app(ResonanceManager::class);

    $data = [
        'user' => [
            'id' => 1,
            'profile' => [
                'name' => 'John',
                'settings' => ['theme' => 'dark', 'notifications' => true],
            ],
        ],
        'permissions' => ['read', 'write', 'admin'],
    ];

    $response = $manager->response($data);
    $content = $response->getData(true);

    expect($content['data'])->toMatchArray($data);
});

it('handles empty array data', function () {
    $manager = app(ResonanceManager::class);

    $response = $manager->response([]);
    $content = $response->getData(true);

    expect($content['data'])->toBe([]);
});

it('handles scalar data values', function () {
    $manager = app(ResonanceManager::class);

    $response = $manager->response('simple string');
    $content = $response->getData(true);

    expect($content['data'])->toBe('simple string');
});

it('handles numeric data values', function () {
    $manager = app(ResonanceManager::class);

    $response = $manager->response(42);
    $content = $response->getData(true);

    expect($content['data'])->toBe(42);
});

it('handles boolean data values', function () {
    $manager = app(ResonanceManager::class);

    $response = $manager->response(true);
    $content = $response->getData(true);

    expect($content['data'])->toBeTrue();
});
