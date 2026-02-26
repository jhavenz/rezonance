<?php

use Jhavenz\Resonance\Facades\Resonance;
use Jhavenz\Resonance\Middleware\TransformResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

beforeEach(function () {
    // Define test routes for each test
    Route::middleware(['api', TransformResponse::class])->group(function () {
        Route::get('/test-json', fn () => response()->json(['foo' => 'bar']));
        Route::get('/test-array', fn () => ['items' => [1, 2, 3]]);
        Route::get('/test-redirect', fn () => redirect('/dashboard'));
        Route::get('/test-error', fn () => response()->json(['error' => 'Not found'], 404));
        Route::get('/test-validation', fn () => response()->json(['errors' => ['email' => 'required']], 422));
        Route::get('/test-with-signals', function () {
            Resonance::flash('Success!', 'success');
            return ['created' => true];
        });
        Route::get('/test-resonance-response', function () {
            Resonance::invalidate('posts');
            return Resonance::response(['id' => 1]);
        });
    });
});

it('wraps JSON responses in envelope structure', function () {
    $response = $this->getJson('/test-json');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => ['foo'],
            'meta' => ['signals', 'timestamp', 'trace_id'],
        ])
        ->assertJsonPath('data.foo', 'bar');
});

it('wraps array responses in envelope structure', function () {
    $response = $this->getJson('/test-array');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => ['items'],
            'meta' => ['signals', 'timestamp', 'trace_id'],
        ])
        ->assertJsonPath('data.items', [1, 2, 3]);
});

it('passes through redirect responses unchanged', function () {
    // Note: The middleware's isSuccessful() check returns false for 302 redirects,
    // so they pass through before transformResponse() can convert them to signals.
    // This is current behavior - redirects are handled by the browser natively.
    $response = $this->getJson('/test-redirect');

    // Redirect responses pass through with 302 status
    $response->assertStatus(302);
});

it('passes through error responses unchanged', function () {
    $response = $this->getJson('/test-error');

    $response->assertStatus(404)
        ->assertJson(['error' => 'Not found']);

    // Should NOT have envelope structure since it's an error
    $response->assertJsonMissingPath('meta.signals');
});

it('passes through validation errors unchanged', function () {
    $response = $this->getJson('/test-validation');

    $response->assertStatus(422)
        ->assertJson(['errors' => ['email' => 'required']]);

    // Should NOT have envelope structure since it's an error
    $response->assertJsonMissingPath('meta.signals');
});

it('includes queued signals in envelope meta', function () {
    $response = $this->getJson('/test-with-signals');

    $response->assertStatus(200)
        ->assertJsonPath('data.created', true);

    $signals = $response->json('meta.signals');
    expect($signals)->toBeArray()
        ->and(collect($signals)->where('type', 'flash')->first())
        ->toMatchArray([
            'type' => 'flash',
            'message' => 'Success!',
            'variant' => 'success',
        ]);
});

it('does not double-wrap Resonance::response() output', function () {
    $response = $this->getJson('/test-resonance-response');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => ['id'],
            'meta' => ['signals', 'timestamp', 'trace_id'],
        ])
        ->assertJsonPath('data.id', 1);

    // Should only have one level of data/meta, not nested
    $response->assertJsonMissingPath('data.data');
    $response->assertJsonMissingPath('data.meta');

    // Should include the invalidate signal
    $signals = $response->json('meta.signals');
    expect(collect($signals)->where('type', 'invalidate')->first())
        ->toMatchArray([
            'type' => 'invalidate',
            'scope' => ['posts'],
        ]);
});

it('generates unique trace_id for each request', function () {
    $response1 = $this->getJson('/test-json');
    $response2 = $this->getJson('/test-json');

    $traceId1 = $response1->json('meta.trace_id');
    $traceId2 = $response2->json('meta.trace_id');

    expect($traceId1)->not->toBe($traceId2)
        ->and($traceId1)->toBeString()
        ->and($traceId2)->toBeString();
});

it('includes timestamp in envelope meta', function () {
    $before = now()->getTimestampMs();
    $response = $this->getJson('/test-json');
    $after = now()->getTimestampMs();

    $timestamp = $response->json('meta.timestamp');

    expect($timestamp)->toBeInt()
        ->and($timestamp)->toBeGreaterThanOrEqual($before)
        ->and($timestamp)->toBeLessThanOrEqual($after);
});
