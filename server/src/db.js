import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EVENT_TYPES, STATUS, getThreeWeekWindow, nowIso, minutesBetween, formatDate, formatDay, formatDuration, formatTime } from "./time.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = process.env.DATA_DIR || path.resolve(__dirname, "../../data");
const dbPath = process.env.DB_PATH || path.join(dataDir, "workshop.sqlite");

fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN', 'CALEB')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      nfc_uid TEXT UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      admin_access INTEGER NOT NULL DEFAULT 0,
      admin_password_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS time_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      event_type TEXT NOT NULL CHECK(event_type IN (
        'START_SHIFT',
        'START_LUNCH',
        'END_LUNCH',
        'START_SMOKE',
        'END_SMOKE',
        'END_SHIFT'
      )),
      event_time TEXT NOT NULL,
      created_at TEXT NOT NULL,
      edited_by TEXT,
      edited_at TEXT,
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_time_events_employee_time ON time_events(employee_id, event_time, id);
    CREATE INDEX IF NOT EXISTS idx_time_events_time ON time_events(event_time);
  `);

  addColumnIfMissing("employees", "admin_access", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("employees", "admin_password_hash", "TEXT");
}

export function seedCalebUser() {
  const email = process.env.CALEB_EMAIL || "Caleb@westcoastautoair.com.au";
  const password = process.env.CALEB_PASSWORD || "1716";
  const existing = db.prepare("SELECT id FROM users WHERE lower(email) = lower(?)").get(email);

  if (!existing) {
    db.prepare("INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, 'CALEB', ?)").run(
      email,
      bcrypt.hashSync(password, 12),
      nowIso(),
    );
  }
}

export function initialiseDatabase() {
  migrate();
  seedCalebUser();
}

export function publicEmployee(employee) {
  if (!employee) {
    return null;
  }

  return {
    id: employee.id,
    fullName: employee.full_name,
    nfcUid: employee.nfc_uid,
    active: Boolean(employee.active),
    adminAccess: Boolean(employee.admin_access),
    hasAdminPassword: Boolean(employee.admin_password_hash),
    createdAt: employee.created_at,
    updatedAt: employee.updated_at,
    status: getEmployeeStatus(employee.id),
  };
}

export function findUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email);
}

export function findAdminEmployeeByName(name) {
  return db
    .prepare("SELECT * FROM employees WHERE lower(full_name) = lower(?) AND active = 1 AND admin_access = 1")
    .get(String(name || "").trim());
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function verifyEmployeePin(employeeId, pin) {
  const row = db.prepare("SELECT pin_hash FROM employees WHERE id = ?").get(employeeId);
  return Boolean(row && bcrypt.compareSync(pin, row.pin_hash));
}

export function listEmployees() {
  return db
    .prepare("SELECT * FROM employees ORDER BY active DESC, full_name COLLATE NOCASE")
    .all()
    .map(publicEmployee);
}

export function getEmployeeById(id) {
  return publicEmployee(db.prepare("SELECT * FROM employees WHERE id = ?").get(id));
}

export function getEmployeeByUid(uid) {
  return publicEmployee(db.prepare("SELECT * FROM employees WHERE lower(nfc_uid) = lower(?)").get(normaliseUid(uid)));
}

export function createEmployee({ fullName, pin, nfcUid, adminAccess = false, adminPassword = "" }) {
  const now = nowIso();
  const result = db
    .prepare(
      "INSERT INTO employees (full_name, pin_hash, nfc_uid, active, admin_access, admin_password_hash, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?, ?)",
    )
    .run(
      fullName.trim(),
      bcrypt.hashSync(pin, 12),
      normaliseUid(nfcUid),
      adminAccess ? 1 : 0,
      adminAccess && adminPassword ? bcrypt.hashSync(adminPassword, 12) : null,
      now,
      now,
    );

  return getEmployeeById(result.lastInsertRowid);
}

export function updateEmployee(id, { fullName, nfcUid, active, adminAccess, adminPassword }) {
  const employee = db.prepare("SELECT * FROM employees WHERE id = ?").get(id);
  if (!employee) {
    return null;
  }

  const nextAdminAccess = adminAccess === undefined ? employee.admin_access : adminAccess ? 1 : 0;
  const nextAdminPasswordHash = adminPassword
    ? bcrypt.hashSync(String(adminPassword), 12)
    : nextAdminAccess
      ? employee.admin_password_hash
      : null;

  db.prepare(
    "UPDATE employees SET full_name = ?, nfc_uid = ?, active = ?, admin_access = ?, admin_password_hash = ?, updated_at = ? WHERE id = ?",
  ).run(
    fullName?.trim() || employee.full_name,
    nfcUid === undefined ? employee.nfc_uid : normaliseUid(nfcUid),
    active === undefined ? employee.active : active ? 1 : 0,
    nextAdminAccess,
    nextAdminPasswordHash,
    nowIso(),
    id,
  );

  return getEmployeeById(id);
}

export function changeEmployeePin(id, pin) {
  const result = db.prepare("UPDATE employees SET pin_hash = ?, updated_at = ? WHERE id = ?").run(
    bcrypt.hashSync(pin, 12),
    nowIso(),
    id,
  );
  return result.changes > 0;
}

export function removeEmployee(id) {
  const hasEvents = db.prepare("SELECT 1 FROM time_events WHERE employee_id = ? LIMIT 1").get(id);
  if (hasEvents) {
    return Boolean(updateEmployee(id, { active: false, nfcUid: null }));
  }

  const result = db.prepare("DELETE FROM employees WHERE id = ?").run(id);
  return result.changes > 0;
}

export function normaliseUid(uid) {
  if (uid === null || uid === undefined || String(uid).trim() === "") {
    return null;
  }

  return String(uid).replace(/[^a-fA-F0-9]/g, "").toUpperCase();
}

export function getEmployeeEvents(employeeId, options = {}) {
  const { startIso, endIso } = options;
  let sql = "SELECT * FROM time_events WHERE employee_id = ?";
  const params = [employeeId];

  if (startIso) {
    sql += " AND event_time >= ?";
    params.push(startIso);
  }

  if (endIso) {
    sql += " AND event_time < ?";
    params.push(endIso);
  }

  sql += " ORDER BY event_time, id";
  return db.prepare(sql).all(...params);
}

export function getCurrentShiftEvents(employeeId) {
  const events = getEmployeeEvents(employeeId);
  const lastStartIndex = findLastIndex(events, (event) => event.event_type === "START_SHIFT");
  if (lastStartIndex === -1) {
    return [];
  }

  const shiftEvents = events.slice(lastStartIndex);
  const endShift = shiftEvents.find((event) => event.event_type === "END_SHIFT");
  return endShift ? [] : shiftEvents;
}

export function getEmployeeStatus(employeeId) {
  const events = getCurrentShiftEvents(employeeId);
  if (events.length === 0) {
    return STATUS.OFF_SHIFT;
  }

  const last = events[events.length - 1].event_type;
  if (last === "START_LUNCH") {
    return STATUS.LUNCH;
  }
  if (last === "START_SMOKE") {
    return STATUS.SMOKE;
  }
  if (last === "END_SHIFT") {
    return STATUS.OFF_SHIFT;
  }
  return STATUS.WORKING;
}

export function getAllowedActions(employeeId) {
  const shiftEvents = getCurrentShiftEvents(employeeId);
  const status = getEmployeeStatus(employeeId);
  const lunchStarted = shiftEvents.some((event) => event.event_type === "START_LUNCH");

  if (status === STATUS.OFF_SHIFT) {
    return [{ type: "START_SHIFT", label: "Start Shift", requiresPin: true }];
  }

  if (status === STATUS.LUNCH) {
    return [{ type: "END_LUNCH", label: "End Lunch Break", requiresPin: true }];
  }

  if (status === STATUS.SMOKE) {
    return [{ type: "END_SMOKE", label: "End Smoke Break", requiresPin: true }];
  }

  return [
    !lunchStarted && { type: "START_LUNCH", label: "Start Lunch Break", requiresPin: true },
    { type: "START_SMOKE", label: "Start Smoke Break", requiresPin: true },
    { type: "END_SHIFT", label: "End Shift", requiresPin: true },
  ].filter(Boolean);
}

export function validateAction(employeeId, eventType) {
  if (!EVENT_TYPES.includes(eventType)) {
    return "Unknown action.";
  }

  const allowed = getAllowedActions(employeeId).map((action) => action.type);
  return allowed.includes(eventType) ? null : "That action is not allowed for the employee's current status.";
}

export function addTimeEvent({ employeeId, eventType, eventTime = nowIso(), editedBy = null }) {
  const result = db
    .prepare(
      "INSERT INTO time_events (employee_id, event_type, event_time, created_at, edited_by, edited_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(employeeId, eventType, new Date(eventTime).toISOString(), nowIso(), editedBy, editedBy ? nowIso() : null);

  return db.prepare("SELECT * FROM time_events WHERE id = ?").get(result.lastInsertRowid);
}

export function updateTimeEvent(id, { eventTime, editedBy }) {
  const result = db
    .prepare("UPDATE time_events SET event_time = ?, edited_by = ?, edited_at = ? WHERE id = ?")
    .run(new Date(eventTime).toISOString(), editedBy, nowIso(), id);

  return result.changes > 0 ? db.prepare("SELECT * FROM time_events WHERE id = ?").get(id) : null;
}

export function deleteTimeEvent(id) {
  const result = db.prepare("DELETE FROM time_events WHERE id = ?").run(id);
  return result.changes > 0;
}

export function listRecentEvents() {
  const { startIso } = getThreeWeekWindow();
  return db
    .prepare(
      `SELECT te.*, e.full_name
       FROM time_events te
       JOIN employees e ON e.id = te.employee_id
       WHERE te.event_time >= ?
       ORDER BY te.event_time DESC, te.id DESC
       LIMIT 200`,
    )
    .all(startIso);
}

export function getTimesheet(employeeId) {
  const employee = getEmployeeById(employeeId);
  if (!employee) {
    return null;
  }

  const { startIso, endIso } = getThreeWeekWindow();
  const events = getEmployeeEvents(employeeId, { startIso, endIso });

  return {
    employee,
    rows: buildTimesheetRows(events),
  };
}

export function getAllTimesheets() {
  return listEmployees().map((employee) => getTimesheet(employee.id)).filter(Boolean);
}

export function buildTimesheetRows(events) {
  const rows = [];
  let current = null;
  let lunchStart = null;
  let smokeStart = null;

  for (const event of events) {
    if (event.event_type === "START_SHIFT") {
      if (current) {
        rows.push(finaliseShift(current));
      }
      current = {
        eventIds: { start: event.id },
        start: event.event_time,
        finish: null,
        lunch: null,
        smokes: [],
      };
      lunchStart = null;
      smokeStart = null;
      continue;
    }

    if (!current) {
      continue;
    }

    if (event.event_type === "START_LUNCH") {
      lunchStart = event;
    } else if (event.event_type === "END_LUNCH" && lunchStart) {
      current.lunch = { start: lunchStart.event_time, end: event.event_time, startEventId: lunchStart.id, endEventId: event.id };
      lunchStart = null;
    } else if (event.event_type === "START_SMOKE") {
      smokeStart = event;
    } else if (event.event_type === "END_SMOKE" && smokeStart) {
      current.smokes.push({ start: smokeStart.event_time, end: event.event_time, startEventId: smokeStart.id, endEventId: event.id });
      smokeStart = null;
    } else if (event.event_type === "END_SHIFT") {
      current.finish = event.event_time;
      current.eventIds.finish = event.id;
      rows.push(finaliseShift(current));
      current = null;
      lunchStart = null;
      smokeStart = null;
    }
  }

  if (current) {
    rows.push(finaliseShift(current));
  }

  return rows;
}

function finaliseShift(shift) {
  const finish = shift.finish || nowIso();
  const unpaidBreaks = [
    shift.lunch && minutesBetween(shift.lunch.start, shift.lunch.end),
    ...shift.smokes.map((smoke) => minutesBetween(smoke.start, smoke.end)),
  ]
    .filter(Boolean)
    .reduce((total, milliseconds) => total + milliseconds, 0);
  const workedMs = minutesBetween(shift.start, finish) - unpaidBreaks;

  return {
    day: formatDay(shift.start),
    date: formatDate(shift.start),
    start: formatTime(shift.start),
    lunch: shift.lunch ? `${formatTime(shift.lunch.start)} - ${formatTime(shift.lunch.end)}` : "None",
    smokes: shift.smokes.length ? shift.smokes.map((smoke) => `${formatTime(smoke.start)} - ${formatTime(smoke.end)}`) : ["None"],
    finish: shift.finish ? formatTime(shift.finish) : "Open",
    worked: formatDuration(workedMs),
    raw: shift,
  };
}

function findLastIndex(items, predicate) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index], index)) {
      return index;
    }
  }
  return -1;
}

function addColumnIfMissing(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}
