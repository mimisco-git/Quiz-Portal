import { seedDatabase } from "../src/lib/seed.js";
import app from "../server.js";

seedDatabase().catch(console.error);

export default app;
