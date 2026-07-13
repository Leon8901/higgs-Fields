import { clerkClient } from "@clerk/express";
await clerkClient.sessions.revokeSession("sess_3GR6DnKvGo7OHUjxBp1R6Bp5ZDX");
await clerkClient.sessions.revokeSession("sess_3GR6y4yiwfkrp9Y4qco33Z6oDvt");
console.log("done");
