import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import {
  addTimeEvent,
  changeEmployeePin,
  createEmployee,
  deleteTimeEvent,
  findUserByEmail,
  getAllTimesheets,
  getAllowedActions,
  getEmployeeById,
  getEmployeeByUid,
  getTimesheet,
  initialiseDatabase,
  listEmployees,
  listRecentEvents,
  removeEmployee,
  updateEmployee,
  updateTimeEvent,
  validateAction,
  verifyEmployeePin,
  verifyPassword,
} from "./db.js";
import { EVENT_TYPES } from "./time.js";
import { nfcService } from "./nfc.js";

dotenv.config();
initialiseDatabase();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3000);
const tokens = new Map();

app.use(cors());
app.use(express.json());

nfcService.on("error", (error) => {
  console.warn("NFC service warning:", error.message);
});
nfcService.start();

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, nfc: nfcService.getStatus() });
});

app.post("/api/auth/login", (request, response) => {
  const { email, password } = request.body || {};
  const user = email ? findUserByEmail(email) : null;

  if (!user || !verifyPassword(String(password || ""), user.password_hash)) {
    response.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const token = crypto.randomUUID();
  tokens.set(token, {
    id: user.id,
    email: user.email,
    role: user.role,
  });

  response.json({ token, user: tokens.get(token) });
});

app.get("/api/auth/me", requireAuth(), (request, response) => {
  response.json({ user: request.user });
});

app.get("/api/nfc/status", (_request, response) => {
  response.json(nfcService.getStatus());
});

app.get("/api/nfc/scan", (request, response) => {
  response.json({ scan: nfcService.getLastScan(request.query.since) });
});

app.post("/api/nfc/manual-scan", (request, response) => {
  const uid = request.body?.uid;
  if (!uid) {
    response.status(400).json({ error: "Card UID is required." });
    return;
  }

  response.json({ scan: nfcService.recordScan(uid, "manual") });
});

app.get("/api/signin/card/:uid", (request, response) => {
  const employee = getEmployeeByUid(request.params.uid);
  if (!employee) {
    response.status(404).json({ error: "Card is not assigned to an employee." });
    return;
  }

  if (!employee.active) {
    response.status(403).json({ error: "Employee is inactive." });
    return;
  }

  response.json({
    employee,
    actions: getAllowedActions(employee.id),
  });
});

app.post("/api/signin/action", (request, response) => {
  const { uid, action, pin } = request.body || {};
  const employee = uid ? getEmployeeByUid(uid) : null;

  if (!employee) {
    response.status(404).json({ error: "Card is not assigned to an employee." });
    return;
  }

  if (!employee.active) {
    response.status(403).json({ error: "Employee is inactive." });
    return;
  }

  const allowedAction = getAllowedActions(employee.id).find((item) => item.type === action);
  if (!allowedAction) {
    response.status(400).json({ error: validateAction(employee.id, action) || "Action not available." });
    return;
  }

  if (allowedAction.requiresPin && !verifyEmployeePin(employee.id, String(pin || ""))) {
    response.status(401).json({ error: "Incorrect PIN." });
    return;
  }

  const event = addTimeEvent({ employeeId: employee.id, eventType: action });
  response.json({
    event,
    employee: getEmployeeById(employee.id),
    message: `${allowedAction.label} saved.`,
  });
});

app.get("/api/employees", requireAuth(), (_request, response) => {
  response.json({ employees: listEmployees() });
});

app.get("/api/employees/:id/timesheet", requireAuth(), (request, response) => {
  const timesheet = getTimesheet(Number(request.params.id));
  if (!timesheet) {
    response.status(404).json({ error: "Employee not found." });
    return;
  }

  response.json(timesheet);
});

app.get("/api/timesheets/all", requireAuth(), (_request, response) => {
  response.json({ timesheets: getAllTimesheets() });
});

app.post("/api/caleb/employees", requireAuth("CALEB"), (request, response) => {
  const { fullName, pin, nfcUid } = request.body || {};
  const error = validateEmployeeInput({ fullName, pin, nfcUid }, true);
  if (error) {
    response.status(400).json({ error });
    return;
  }

  try {
    response.status(201).json({ employee: createEmployee({ fullName, pin, nfcUid }) });
  } catch (error_) {
    response.status(400).json({ error: friendlySqliteError(error_) });
  }
});

app.put("/api/caleb/employees/:id", requireAuth("CALEB"), (request, response) => {
  try {
    const employee = updateEmployee(Number(request.params.id), request.body || {});
    if (!employee) {
      response.status(404).json({ error: "Employee not found." });
      return;
    }
    response.json({ employee });
  } catch (error_) {
    response.status(400).json({ error: friendlySqliteError(error_) });
  }
});

app.post("/api/caleb/employees/:id/pin", requireAuth("CALEB"), (request, response) => {
  const pin = String(request.body?.pin || "");
  if (!/^\d{4}$/.test(pin)) {
    response.status(400).json({ error: "PIN must be exactly 4 digits." });
    return;
  }

  const changed = changeEmployeePin(Number(request.params.id), pin);
  response.status(changed ? 200 : 404).json(changed ? { ok: true } : { error: "Employee not found." });
});

app.delete("/api/caleb/employees/:id", requireAuth("CALEB"), (request, response) => {
  const removed = removeEmployee(Number(request.params.id));
  response.status(removed ? 200 : 404).json(removed ? { ok: true } : { error: "Employee not found." });
});

app.get("/api/caleb/events", requireAuth("CALEB"), (_request, response) => {
  response.json({ events: listRecentEvents() });
});

app.post("/api/caleb/events", requireAuth("CALEB"), (request, response) => {
  const { employeeId, eventType, eventTime } = request.body || {};
  if (!employeeId || !EVENT_TYPES.includes(eventType)) {
    response.status(400).json({ error: "Employee and event type are required." });
    return;
  }

  response.status(201).json({
    event: addTimeEvent({
      employeeId: Number(employeeId),
      eventType,
      eventTime,
      editedBy: request.user.email,
    }),
  });
});

app.put("/api/caleb/events/:id", requireAuth("CALEB"), (request, response) => {
  if (!request.body?.eventTime) {
    response.status(400).json({ error: "Event time is required." });
    return;
  }

  const event = updateTimeEvent(Number(request.params.id), {
    eventTime: request.body.eventTime,
    editedBy: request.user.email,
  });
  response.status(event ? 200 : 404).json(event ? { event } : { error: "Event not found." });
});

app.delete("/api/caleb/events/:id", requireAuth("CALEB"), (request, response) => {
  const deleted = deleteTimeEvent(Number(request.params.id));
  response.status(deleted ? 200 : 404).json(deleted ? { ok: true } : { error: "Event not found." });
});

const clientDist = path.resolve(__dirname, "../../dist");
app.use(express.static(clientDist));
app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(clientDist, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Workshop Sign-In System running at http://localhost:${port}`);
});

function requireAuth(role) {
  return (request, response, next) => {
    const header = request.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    const user = token ? tokens.get(token) : null;

    if (!user) {
      response.status(401).json({ error: "Login required." });
      return;
    }

    if (role && user.role !== role) {
      response.status(403).json({ error: "Permission denied." });
      return;
    }

    request.user = user;
    next();
  };
}

function validateEmployeeInput({ fullName, pin, nfcUid }, requirePin) {
  if (!fullName || String(fullName).trim().length < 2) {
    return "Full name is required.";
  }

  if (requirePin && !/^\d{4}$/.test(String(pin || ""))) {
    return "PIN must be exactly 4 digits.";
  }

  if (!nfcUid) {
    return "Assign a card before saving the employee.";
  }

  return null;
}

function friendlySqliteError(error) {
  if (String(error.message).includes("UNIQUE constraint failed: employees.nfc_uid")) {
    return "That card is already assigned to another employee.";
  }

  return error.message;
}
