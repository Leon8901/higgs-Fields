---
name: Diagnosing "Unauthorized" 401s without a real browser login
description: How to reproduce authenticated API failures end-to-end when the agent can't drive Clerk's sign-in UI interactively.
---

Screenshot/browser tools here can't type/click through Clerk's real sign-in flow, so a reported "Unauthorized" 401 can't be reproduced by literally clicking through the UI. Instead, mint a real session server-side for an existing user row and hit the route directly:

```ts
import { clerkClient } from "@clerk/express";
const session = await clerkClient.sessions.createSession({ userId }); // real clerkId from usersTable
const { jwt } = await clerkClient.sessions.getToken(session.id, undefined as any);
// fetch(..., { headers: { authorization: `Bearer ${jwt}` } }) — @clerk/express's getAuth accepts Bearer JWTs, not just cookies
await clerkClient.sessions.revokeSession(session.id); // always clean up
```

**Why:** this is the only reliable way to distinguish "the backend route is broken" from "the frontend request during the user's test wasn't actually authenticated" — one confirmed case turned out to be the latter (backend 200'd fine with a real session; the reported failure was a signed-out/stale-session browser state, not a code bug).

**How to apply:** before touching any code in response to a reported 401, run this kind of live probe against the real route with a real DB user. If it succeeds, the bug is not server-side — look at session/cookie state on the client side per the clerk-auth troubleshoot skill, don't guess-patch the backend. Also clean up any test artifacts (e.g. a key saved to a real user's account) immediately after.
