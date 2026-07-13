import { clerkClient } from "@clerk/express";
const userId = "user_3GR43a4GqQyUy9YxoZuwn9Yn4x8";
const session = await clerkClient.sessions.createSession({ userId });
const { jwt } = await clerkClient.sessions.getToken(session.id, undefined);
console.log(JSON.stringify({ sessionId: session.id, jwt }));
