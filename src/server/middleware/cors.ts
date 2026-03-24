import { cors } from "hono/cors";

export const corsMiddleware = cors({
	origin: ["http://localhost:5173", "http://localhost:7575"],
	allowMethods: ["GET", "POST", "PUT", "DELETE"],
	allowHeaders: ["Content-Type"],
});
