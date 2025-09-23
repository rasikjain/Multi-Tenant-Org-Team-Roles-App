import "dotenv/config";
import express from "express";
import cors from "cors";
import { authMiddleware, orgScopeFromParam, requireOrgParamMatch } from "./middleware/auth";
import orgsRouter from "./routes/orgs";
import teamsRouter from "./routes/teams";
import membersRouter from "./routes/members";
import invitesRouter from "./routes/invites";
import { makeError } from "./types/errors";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "fs";
import { resolve } from "path";
import YAML from "yaml";

const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// Swagger UI from OpenAPI YAML
const openapiPath = resolve(process.cwd(), "src", "openapi.yaml");
const openapiDoc = YAML.parse(readFileSync(openapiPath, "utf8"));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDoc));

// Auth header middleware for all app routes
app.use(authMiddleware);
app.use(orgScopeFromParam);
app.use(requireOrgParamMatch);

// Routes
app.use(orgsRouter);
app.use(teamsRouter);
app.use(membersRouter);
app.use(invitesRouter);

// 404
app.use((_req, res) => res.status(404).json(makeError("NOT_FOUND", "Route not found")));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
});

