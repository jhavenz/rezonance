# Rezonance Integration Guide: Three Progressive Examples

*A prompt for AI assistants implementing signal-based cache invalidation with Laravel + React Query*

---

## Context You're Working With

You're implementing a frontend application that consumes the `rezonance` NPM package and a Laravel backend using the `jhavenz/rezonance` Composer package. The core premise: **the backend owns cache invalidation decisions**. When a mutation succeeds, the server tells the client which queries to refetch via "signals" embedded in the response envelope. You never manually call `queryClient.invalidateQueries()` in your frontend mutation handlers.

The stack flows like this: PHP controllers decorated with Query/Mutation attributes get parsed by Scramble into an OpenAPI spec. Kubb reads that spec and generates TypeScript types, Zod validation schemas, and React Query hooks. Your frontend imports these generated hooks, and when mutations complete, a signal processor automatically invalidates the relevant cached queries.

The response envelope from every API call contains a `data` field with the actual payload and a `meta.signals` array. After successful mutations, the Resonance client iterates those signals and dispatches the appropriate side effects—cache invalidation, toast notifications, redirects, or custom events.

---

## Example 1: Basic Todo List (Signal-Based Invalidation Fundamentals)

**Goal**: Understand the core invalidation loop without any complications.

### What You're Building

A single-page todo list where users can view tasks, add new ones, and delete them. Every mutation triggers backend signals that refresh the task list automatically.

### Backend Shape

You need a TaskController with three endpoints. The index action returns all tasks for the authenticated user, decorated with a Query attribute that names it something like `fetchTasks` in the `demo.tasks` group. The store action accepts a title string, creates the task, and returns it—but crucially, before returning, it chains a Resonance flash message and an invalidation signal targeting the index query's route name. The destroy action deletes a task and similarly signals invalidation.

The Resonance facade provides a fluent interface. You call `Resonance::flash('Task created')` which returns a builder, then chain `->invalidate('demo.tasks.index')` to queue that signal, then `->response($task)` to wrap everything in the envelope. The middleware handles the actual wrapping—you just build the signal chain.

### Frontend Shape

Your page component imports the generated hooks: one for fetching (returns a standard useQuery result), one for creating (returns a useMutation result), one for deleting. The fetch hook runs on mount and caches under a query key that includes the URL path.

The create mutation's `onSuccess` callback does **nothing related to cache invalidation**. You might clear a form input, but you don't touch the query client. The signal processor has already handled invalidation by the time your callback runs. This is the mental shift: trust the backend.

### What to Verify

After implementing, add a task and watch the network tab. You should see the POST return with a `meta.signals` array containing an invalidate signal. Immediately after, a GET request fires to refetch the task list. The cache key gets invalidated automatically, triggering the refetch.

If you accidentally add manual invalidation in `onSuccess`, you'll see a duplicate GET request. Remove it. The system handles this.

### Common Pitfalls

Forgetting to apply the `resonance` middleware to your routes means responses won't be wrapped in envelopes. You'll get raw data without the `meta` field, and signals won't process.

Using `auth()->user()->tasks` in a controller without the `auth:sanctum` middleware will throw a 500 when unauthenticated because you're calling a method on null. Always apply auth middleware to protected routes.

---

## Example 2: Profile with Avatar Upload (File Handling + Multi-Scope Invalidation)

**Goal**: Handle file uploads and understand invalidation that affects multiple independent queries.

### What You're Building

A profile page where users see their name, email, and avatar. They can update their name and upload a new avatar image. The avatar also appears in a navbar component that's rendered outside the profile page. When the profile updates, both the profile query AND the user query (used by the navbar) need to refresh.

### Backend Shape

The profile show endpoint returns the authenticated user with any loaded relationships. The update endpoint accepts multipart form data—a name field and an optional avatar file. After validation and storage, it signals invalidation for TWO scopes: the profile query and the auth user query.

The Resonance invalidate method accepts multiple route names. You chain `->invalidate('demo.profile.show', 'auth.user')` to target both. When this signal processes on the frontend, both queries get invalidated and refetch independently.

File upload handling in Laravel is standard—use `$request->file('avatar')` and store it. The key insight is that the signal system doesn't care about the payload shape. It works the same for JSON and multipart requests.

### Frontend Shape

Your profile form needs to submit as FormData, not JSON. When building the FormData object, append the name field and the file (if present). The generated mutation hook accepts this FormData directly.

**Critical**: Do not set a Content-Type header manually. The browser must set it automatically with the correct multipart boundary. If you force `Content-Type: multipart/form-data`, the boundary will be missing and the server will fail to parse the upload.

The navbar component uses a separate query for user data—likely the same hook used for authentication checks. When the profile update succeeds, both this navbar query and the profile query refetch because the backend signaled both scopes.

### What to Verify

Upload an avatar, then watch both the profile section and navbar update without any manual coordination. In the network tab, you should see a POST (the update), followed by two GETs (profile and user). The signals array in the POST response will show both route names in the scope array.

### Common Pitfalls

Setting the Content-Type header on FormData requests is the most common mistake. Let the browser handle it.

Forgetting to signal the user query means the navbar shows stale data until the user navigates away or the cache expires naturally. This is exactly what signal-based invalidation prevents—you declare all affected scopes at the source of truth (the backend).

If your navbar uses a different query key structure than the signal processor expects, invalidation won't match. The processor converts route names to URL paths and matches against query keys that contain URL strings. Ensure consistency between your generated hooks and manual queries.

---

## Example 3: Social Feed with Optimistic Updates + SSE Streaming (Advanced Patterns)

**Goal**: Combine optimistic UI, signal-based rollback, infinite queries, and real-time streaming.

### What You're Building

A social feed showing posts with like counts. Users can like/unlike posts with instant UI feedback (optimistic update). The feed is paginated with infinite scroll. A separate feature shows AI-generated content streaming in via Server-Sent Events.

### Optimistic Updates with Signal Backup

When a user clicks "like," you want the UI to update immediately—don't wait for the server round trip. React Query's optimistic update pattern involves three mutation callbacks: `onMutate` (runs before the request, returns context for rollback), `onError` (runs if request fails, uses context to revert), and `onSettled` (runs after success or failure, typically refetches).

Here's the nuance with Resonance: you still do optimistic updates in `onMutate`, and you still handle rollback in `onError`. But you **remove refetching from `onSettled`**. The backend signal handles the "source of truth" refetch after success. Your optimistic update is purely for perceived performance—it doesn't need to coordinate with cache invalidation.

If the mutation fails, `onError` rolls back to the snapshot you captured in `onMutate`. The signal never fires because the request failed. If the mutation succeeds, the signal invalidates and refetches, replacing your optimistic data with real server data. The flow is clean: optimistic for UX, signals for consistency.

### Infinite Query Invalidation

Your feed uses cursor-based pagination via an infinite query. The generated hook has an `Infinite` variant that manages pages internally. When invalidation fires for this query, React Query refetches the first page and resets pagination state.

This is usually fine for social feeds—new content appears at the top after a post action. But consider the UX: if a user has scrolled deep into the feed and triggers an action, full invalidation jumps them back to the top. You might want to invalidate only the specific page containing the affected item, or use a more surgical update strategy.

The signal system invalidates at the query level, not the page level. For most CRUD apps this is correct. For feeds where position matters, consider whether optimistic updates without full invalidation provide better UX.

### SSE Streaming for AI Content

Server-Sent Events provide a different data flow—not request/response, but a persistent stream of events. This doesn't use React Query for caching (there's nothing to cache mid-stream). Instead, you manage local state and append chunks as they arrive.

Your backend returns a streaming response with content-type `text/event-stream`. Each event contains a chunk of AI-generated text. Your frontend uses the EventSource API (or a wrapper) to listen and accumulate chunks into state.

The connection between SSE and Resonance: when streaming completes, your backend might include a final event that triggers invalidation. For example, after AI generates a summary that gets saved, the completion event could signal to refetch a summaries list. The frontend SSE handler checks for this signal-like payload and calls the signal processor manually.

This is an edge case pattern—most Resonance invalidation flows through mutation responses. But it shows the flexibility: signals are a protocol, not locked to one transport.

### What to Verify

For optimistic updates: click like, see immediate count change, then observe the POST and subsequent GET in the network tab. Disable your network and try again—the UI should update, then roll back when the request fails.

For infinite scroll: load several pages, then create a new post. The feed should reset to page one with the new post visible. This might not be ideal UX, but verify it's the expected behavior before deciding to customize.

For SSE: start a generation, watch chunks appear progressively, then verify any post-completion invalidation fires correctly.

### Common Pitfalls

Mixing optimistic updates with manual invalidation in `onSuccess` creates race conditions—you might see the UI flicker as optimistic data gets replaced, then replaced again by refetched data.

Infinite queries have different invalidation semantics than regular queries. Test pagination reset behavior explicitly.

SSE connections need cleanup on component unmount. EventSource doesn't close automatically—you'll leak connections if you don't handle the cleanup effect.

---

## Integration Checklist

Before considering your implementation complete:

**Backend**:
- Routes wrapped with `resonance` middleware
- Protected routes use `auth:sanctum` middleware
- Controllers check for null user where appropriate
- Every mutation ends with `Resonance::response()` or a response builder chain
- Invalidation scopes match the route names of your Query-decorated endpoints

**Frontend**:
- Generated hooks imported from the `.resonance` output directory
- Router context provides QueryClient, ResonanceClient, and NetworkAdapter
- kubb-client configured with the signal processor callback
- No manual `queryClient.invalidateQueries()` in mutation handlers (unless you have a specific reason)
- FormData requests don't manually set Content-Type

**Dev Experience**:
- Scramble exports fresh OpenAPI spec after controller changes
- Kubb regenerates after spec changes (watch mode or manual)
- Browser console shows signal processing logs in development
- Network tab confirms the invalidate-then-refetch pattern

---

## Conceptual Model Summary

Think of your backend as the state machine owner. It knows what actions affect what data. When it performs a mutation, it declares the side effects: "this action should refresh these queries, show this message, maybe redirect here."

Your frontend is reactive to those declarations. It doesn't encode business logic about cache relationships—it just executes what the server says. This inverts the typical React Query pattern where frontend developers manually coordinate invalidation, and it centralizes that logic where the data relationships are actually defined.

The tradeoff: you need backend changes to adjust invalidation behavior. You can't "quick fix" a missing refetch in frontend code alone. This is intentional—it forces cache consistency decisions to live in one place.

---

## Package Installation

```bash
# PHP (Laravel backend)
composer require jhavenz/rezonance

# JavaScript (React frontend)
npm install rezonance
# or
bun add rezonance
```
