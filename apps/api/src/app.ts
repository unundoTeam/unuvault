import Fastify from "fastify";
import { activityRoutes } from "./routes/activity";
import { authRoutes } from "./routes/auth";
import { deviceRoutes } from "./routes/devices";
import { importRoutes } from "./routes/imports";
import { vaultRoutes } from "./routes/vault";

export const app = Fastify();

app.get("/health", async () => ({ ok: true }));
app.register(authRoutes, { prefix: "/auth" });
app.register(vaultRoutes, { prefix: "/vault" });
app.register(deviceRoutes, { prefix: "/devices" });
app.register(importRoutes, { prefix: "/imports" });
app.register(activityRoutes, { prefix: "/activity" });
