import cors from "@fastify/cors";
import Fastify from "fastify";
import { activityRoutes } from "./routes/activity";
import { authRoutes } from "./routes/auth";
import { deviceRoutes } from "./routes/devices";
import { importRoutes } from "./routes/imports";
import { vaultRoutes } from "./routes/vault";

export const app = Fastify();

void app.register(cors, {
  origin: ["http://127.0.0.1:3001", "http://localhost:3001"],
  methods: ["GET", "POST", "OPTIONS"],
});

app.get("/health", async () => ({ ok: true }));
app.register(authRoutes, { prefix: "/auth" });
app.register(vaultRoutes, { prefix: "/vault" });
app.register(deviceRoutes, { prefix: "/devices" });
app.register(importRoutes, { prefix: "/imports" });
app.register(activityRoutes, { prefix: "/activity" });
