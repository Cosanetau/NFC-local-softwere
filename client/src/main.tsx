import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import "./styles.css";

type Role = "ADMIN" | "CALEB";

type User = {
  id: number;
  email: string;
  displayName?: string;
  role: Role;
};

type Employee = {
  id: number;
  fullName: string;
  nfcUid: string | null;
  active: boolean;
  adminAccess: boolean;
  hasAdminPassword: boolean;
  status: string;
};

type Action = {
  type: string;
  label: string;
  requiresPin: boolean;
};

type TimesheetRow = {
  day: string;
  date: string;
  start: string;
  lunch: string;
  smokes: string[];
  finish: string;
  worked: string;
};

type Timesheet = {
  employee: Employee;
  rows: TimesheetRow[];
};

type TimeEvent = {
  id: number;
  employee_id: number;
  full_name?: string;
  event_type: string;
  event_time: string;
  edited_by?: string | null;
  edited_at?: string | null;
};

const apiBase = "";
const authKey = "workshop-auth";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SignInPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<RequireLogin><AdminPage /></RequireLogin>} />
        <Route path="/admin/employee/:employeeId" element={<RequireLogin><EmployeeTimesheetPage /></RequireLogin>} />
        <Route path="/admin/all" element={<RequireLogin><AllTimesheetsPage /></RequireLogin>} />
        <Route path="/caleb" element={<RequireLogin role="CALEB"><CalebPage /></RequireLogin>} />
      </Routes>
    </BrowserRouter>
  );
}

function SignInPage() {
  const [sequence, setSequence] = React.useState(0);
  const [uid, setUid] = React.useState("");
  const [employee, setEmployee] = React.useState<Employee | null>(null);
  const [actions, setActions] = React.useState<Action[]>([]);
  const [pin, setPin] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [manualUid, setManualUid] = React.useState("");

  React.useEffect(() => {
    const timer = window.setInterval(async () => {
      const result = await api<{ scan: { uid: string; sequence: number } | null }>(`/api/nfc/scan?since=${sequence}`, { auth: false });
      if (result.scan) {
        setSequence(result.scan.sequence);
        await loadCard(result.scan.uid);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [sequence]);

  async function loadCard(cardUid: string) {
    setError("");
    setMessage("");
    setPin("");
    setUid(cardUid);

    try {
      const result = await api<{ employee: Employee; actions: Action[] }>(`/api/signin/card/${cardUid}`, { auth: false });
      setEmployee(result.employee);
      setActions(result.actions);
    } catch (error_) {
      setEmployee(null);
      setActions([]);
      setError(getError(error_));
      resetSoon();
    }
  }

  async function submitAction(action: Action) {
    setError("");
    if (action.requiresPin && !/^\d{4}$/.test(pin)) {
      setError("Enter your 4-digit PIN.");
      return;
    }

    try {
      const result = await api<{ message: string }>("/api/signin/action", {
        method: "POST",
        auth: false,
        body: { uid, action: action.type, pin },
      });
      setMessage(result.message);
      setEmployee(null);
      setActions([]);
      setPin("");
      resetSoon();
    } catch (error_) {
      setError(getError(error_));
    }
  }

  async function simulateScan() {
    if (!manualUid.trim()) {
      return;
    }

    await api("/api/nfc/manual-scan", { method: "POST", auth: false, body: { uid: manualUid } });
    setManualUid("");
  }

  function resetSoon() {
    window.setTimeout(() => {
      setMessage("");
      setError("");
      setEmployee(null);
      setActions([]);
      setUid("");
    }, 3500);
  }

  return (
    <main className="kiosk">
      <section className="card kiosk-card">
        <h1>Workshop Sign In</h1>
        {!employee && !message && !error && <p className="tap">Tap Card To Begin</p>}
        {message && <div className="success">{message}</div>}
        {error && <div className="error">{error}</div>}

        {employee && (
          <div className="employee-action">
            <p className="welcome">Welcome {employee.fullName}</p>
            <p className="status">Current Status: {employee.status}</p>

            {actions.some((action) => action.requiresPin) && (
              <input
                aria-label="4 digit PIN"
                className="pin"
                inputMode="numeric"
                maxLength={4}
                placeholder="Enter 4-digit PIN"
                type="password"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            )}

            <div className="actions">
              {actions.map((action) => (
                <button key={action.type} onClick={() => submitAction(action)}>
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <details className="simulator">
          <summary>Reader test</summary>
          <p>Use this only when the NFC reader is not connected during setup.</p>
          <div className="inline">
            <input value={manualUid} onChange={(event) => setManualUid(event.target.value)} placeholder="Card UID" />
            <button type="button" onClick={simulateScan}>Scan</button>
          </div>
        </details>
      </section>
    </main>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = React.useState("Caleb@westcoastautoair.com.au");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    try {
      const result = await api<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        auth: false,
        body: { identifier, password },
      });
      localStorage.setItem(authKey, JSON.stringify(result));
      navigate(result.user.role === "CALEB" ? "/caleb" : "/admin");
    } catch (error_) {
      setError(getError(error_));
    }
  }

  return (
    <main className="page narrow">
      <form className="card form" onSubmit={login}>
        <h1>Management Login</h1>
        {error && <div className="error">{error}</div>}
        <label>Email or Staff Name<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button>Log In</button>
        <Link to="/">Back to sign in</Link>
      </form>
    </main>
  );
}

function AdminPage() {
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    api<{ employees: Employee[] }>("/api/employees")
      .then((result) => setEmployees(result.employees))
      .catch((error_) => setError(getError(error_)));
  }, []);

  return (
    <main className="page">
      <Header title="Admin" />
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <Link className="button" to="/admin/all">All Timesheets</Link>
        <button onClick={() => window.print()}>Print</button>
      </div>
      <section className="card">
        <h2>Staff Status</h2>
        <div className="staff-list">
          {employees.map((employee) => (
            <Link key={employee.id} className="staff-row" to={`/admin/employee/${employee.id}`}>
              <span>{employee.fullName}</span>
              <strong>{employee.status}</strong>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function EmployeeTimesheetPage() {
  const { employeeId } = useParams();
  const [timesheet, setTimesheet] = React.useState<Timesheet | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    api<Timesheet>(`/api/employees/${employeeId}/timesheet`)
      .then(setTimesheet)
      .catch((error_) => setError(getError(error_)));
  }, [employeeId]);

  return (
    <main className="page">
      <Header title={timesheet ? `${timesheet.employee.fullName} Timesheet` : "Timesheet"} />
      <div className="toolbar">
        <Link className="button" to="/admin">Back</Link>
        <button onClick={() => window.print()}>Print Timesheet</button>
      </div>
      {error && <div className="error">{error}</div>}
      {timesheet && <TimesheetTable rows={timesheet.rows} />}
    </main>
  );
}

function AllTimesheetsPage() {
  const [timesheets, setTimesheets] = React.useState<Timesheet[]>([]);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    api<{ timesheets: Timesheet[] }>("/api/timesheets/all")
      .then((result) => setTimesheets(result.timesheets))
      .catch((error_) => setError(getError(error_)));
  }, []);

  return (
    <main className="page">
      <Header title="All Staff Timesheets" />
      <div className="toolbar">
        <Link className="button" to="/admin">Back</Link>
        <button onClick={() => window.print()}>Print All</button>
      </div>
      {error && <div className="error">{error}</div>}
      {timesheets.map((timesheet) => (
        <section className="card print-section" key={timesheet.employee.id}>
          <h2>{timesheet.employee.fullName}</h2>
          <TimesheetTable rows={timesheet.rows} />
        </section>
      ))}
    </main>
  );
}

function CalebPage() {
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [events, setEvents] = React.useState<TimeEvent[]>([]);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  async function refresh() {
    const [employeeResult, eventResult] = await Promise.all([
      api<{ employees: Employee[] }>("/api/employees"),
      api<{ events: TimeEvent[] }>("/api/caleb/events"),
    ]);
    setEmployees(employeeResult.employees);
    setEvents(eventResult.events);
  }

  React.useEffect(() => {
    refresh().catch((error_) => setError(getError(error_)));
  }, []);

  return (
    <main className="page">
      <Header title="Caleb Management" />
      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}
      <div className="grid two">
        <EmployeeForm onSaved={async () => { setMessage("Employee saved."); await refresh(); }} />
        <EmployeeManager
          employees={employees}
          onChanged={async (text) => {
            setMessage(text);
            await refresh();
          }}
        />
      </div>
      <Corrections employees={employees} events={events} onChanged={refresh} />
    </main>
  );
}

function EmployeeForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const [fullName, setFullName] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [nfcUid, setNfcUid] = React.useState("");
  const [adminAccess, setAdminAccess] = React.useState(false);
  const [adminPassword, setAdminPassword] = React.useState("");
  const [waiting, setWaiting] = React.useState(false);
  const [since, setSince] = React.useState(Date.now());
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!waiting) {
      return undefined;
    }

    const timer = window.setInterval(async () => {
      const result = await api<{ scan: { uid: string; sequence: number } | null }>(`/api/nfc/scan?since=${since}`);
      if (result.scan) {
        setNfcUid(result.scan.uid);
        setSince(result.scan.sequence);
        setWaiting(false);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [waiting, since]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/caleb/employees", {
        method: "POST",
        body: { fullName, pin, nfcUid, adminAccess, adminPassword },
      });
      setFullName("");
      setPin("");
      setNfcUid("");
      setAdminAccess(false);
      setAdminPassword("");
      await onSaved();
    } catch (error_) {
      setError(getError(error_));
    }
  }

  return (
    <form className="card form" onSubmit={save}>
      <h2>Add Employee</h2>
      {error && <div className="error">{error}</div>}
      <label>Full Name<input value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
      <label>4 Digit PIN<input inputMode="numeric" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} /></label>
      <label className="checkbox">
        <input type="checkbox" checked={adminAccess} onChange={(event) => setAdminAccess(event.target.checked)} />
        Allow admin access
      </label>
      {adminAccess && (
        <label>Admin Password<input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} /></label>
      )}
      <label>Assigned Card<input readOnly value={nfcUid} placeholder="Click Assign Card, then tap card" /></label>
      <button type="button" className="secondary" onClick={() => { setSince(Date.now()); setWaiting(true); }}>
        {waiting ? "Waiting For Card..." : "Assign Card"}
      </button>
      <button>Save Employee</button>
    </form>
  );
}

function EmployeeManager({ employees, onChanged }: { employees: Employee[]; onChanged: (message: string) => Promise<void> }) {
  const [pinByEmployee, setPinByEmployee] = React.useState<Record<number, string>>({});
  const [adminPasswordByEmployee, setAdminPasswordByEmployee] = React.useState<Record<number, string>>({});

  async function updateEmployee(employee: Employee, patch: Partial<Employee>) {
    await api(`/api/caleb/employees/${employee.id}`, {
      method: "PUT",
      body: {
        fullName: patch.fullName ?? employee.fullName,
        nfcUid: patch.nfcUid ?? employee.nfcUid,
        active: patch.active ?? employee.active,
        adminAccess: patch.adminAccess ?? employee.adminAccess,
      },
    });
    await onChanged("Employee updated.");
  }

  async function updateAdminAccess(employee: Employee, adminAccess: boolean) {
    const adminPassword = adminPasswordByEmployee[employee.id] || "";
    await api(`/api/caleb/employees/${employee.id}`, {
      method: "PUT",
      body: {
        fullName: employee.fullName,
        nfcUid: employee.nfcUid,
        active: employee.active,
        adminAccess,
        adminPassword: adminPassword || undefined,
      },
    });
    setAdminPasswordByEmployee({ ...adminPasswordByEmployee, [employee.id]: "" });
    await onChanged(adminAccess ? "Admin access enabled." : "Admin access disabled.");
  }

  async function changeAdminPassword(employee: Employee) {
    await api(`/api/caleb/employees/${employee.id}`, {
      method: "PUT",
      body: {
        fullName: employee.fullName,
        nfcUid: employee.nfcUid,
        active: employee.active,
        adminAccess: employee.adminAccess,
        adminPassword: adminPasswordByEmployee[employee.id] || "",
      },
    });
    setAdminPasswordByEmployee({ ...adminPasswordByEmployee, [employee.id]: "" });
    await onChanged("Admin password changed.");
  }

  async function changePin(employee: Employee) {
    await api(`/api/caleb/employees/${employee.id}/pin`, {
      method: "POST",
      body: { pin: pinByEmployee[employee.id] || "" },
    });
    setPinByEmployee({ ...pinByEmployee, [employee.id]: "" });
    await onChanged("PIN changed.");
  }

  async function remove(employee: Employee) {
    if (!window.confirm(`Remove ${employee.fullName}?`)) {
      return;
    }
    await api(`/api/caleb/employees/${employee.id}`, { method: "DELETE" });
    await onChanged("Employee removed or deactivated.");
  }

  return (
    <section className="card">
      <h2>Employees</h2>
      <div className="manage-list">
        {employees.map((employee) => (
          <div className="manage-row" key={employee.id}>
            <input value={employee.fullName} onChange={(event) => updateEmployee(employee, { fullName: event.target.value })} />
            <span>{employee.status}</span>
            <span>{employee.nfcUid || "No Card"}</span>
            <label className="checkbox compact">
              <input
                type="checkbox"
                checked={employee.adminAccess}
                onChange={(event) => updateAdminAccess(employee, event.target.checked)}
              />
              Admin
            </label>
            <button onClick={() => updateEmployee(employee, { active: !employee.active })}>
              {employee.active ? "Deactivate" : "Activate"}
            </button>
            <input
              placeholder="New PIN"
              inputMode="numeric"
              maxLength={4}
              value={pinByEmployee[employee.id] || ""}
              onChange={(event) => setPinByEmployee({ ...pinByEmployee, [employee.id]: event.target.value.replace(/\D/g, "").slice(0, 4) })}
            />
            <button onClick={() => changePin(employee)}>Change PIN</button>
            <input
              placeholder={employee.hasAdminPassword ? "New Admin Password" : "Admin Password"}
              type="password"
              value={adminPasswordByEmployee[employee.id] || ""}
              onChange={(event) => setAdminPasswordByEmployee({ ...adminPasswordByEmployee, [employee.id]: event.target.value })}
            />
            <button onClick={() => changeAdminPassword(employee)}>Save Admin Password</button>
            <button className="danger" onClick={() => remove(employee)}>Remove</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Corrections({ employees, events, onChanged }: { employees: Employee[]; events: TimeEvent[]; onChanged: () => Promise<void> }) {
  const [employeeId, setEmployeeId] = React.useState("");
  const [eventType, setEventType] = React.useState("START_SHIFT");
  const [eventTime, setEventTime] = React.useState("");

  async function addEvent(event: React.FormEvent) {
    event.preventDefault();
    await api("/api/caleb/events", {
      method: "POST",
      body: { employeeId, eventType, eventTime },
    });
    setEventTime("");
    await onChanged();
  }

  async function changeEvent(event: TimeEvent, nextTime: string) {
    await api(`/api/caleb/events/${event.id}`, {
      method: "PUT",
      body: { eventTime: nextTime },
    });
    await onChanged();
  }

  async function deleteEvent(event: TimeEvent) {
    if (!window.confirm("Delete this time event?")) {
      return;
    }
    await api(`/api/caleb/events/${event.id}`, { method: "DELETE" });
    await onChanged();
  }

  return (
    <section className="card">
      <h2>Timesheet Corrections</h2>
      <form className="inline wrap" onSubmit={addEvent}>
        <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required>
          <option value="">Choose employee</option>
          {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
        </select>
        <select value={eventType} onChange={(event) => setEventType(event.target.value)}>
          {["START_SHIFT", "START_LUNCH", "END_LUNCH", "START_SMOKE", "END_SMOKE", "END_SHIFT"].map((type) => <option key={type}>{type}</option>)}
        </select>
        <input type="datetime-local" value={eventTime} onChange={(event) => setEventTime(event.target.value)} required />
        <button>Add Missing Event</button>
      </form>
      <div className="event-list">
        {events.map((event) => (
          <div className="event-row" key={event.id}>
            <span>{event.full_name}</span>
            <span>{event.event_type}</span>
            <input
              type="datetime-local"
              value={toLocalInputValue(event.event_time)}
              onChange={(input) => changeEvent(event, input.target.value)}
            />
            <span>{event.edited_by ? `Edited by ${event.edited_by}` : ""}</span>
            <button className="danger" onClick={() => deleteEvent(event)}>Delete</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function TimesheetTable({ rows }: { rows: TimesheetRow[] }) {
  return (
    <section className="card">
      <table>
        <thead>
          <tr>
            <th>Day</th>
            <th>Date</th>
            <th>Start</th>
            <th>Lunch</th>
            <th>Smoke</th>
            <th>Finish</th>
            <th>Worked</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={7}>No records in the last 3 weeks.</td></tr>}
          {rows.map((row, index) => (
            <tr key={`${row.date}-${index}`}>
              <td>{row.day}</td>
              <td>{row.date}</td>
              <td>Start {row.start}</td>
              <td>Lunch {row.lunch}</td>
              <td>Smoke {row.smokes.join(", ")}</td>
              <td>Finish {row.finish}</td>
              <td>Worked {row.worked}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Header({ title }: { title: string }) {
  const auth = getAuth();
  return (
    <header className="header">
      <div>
        <h1>{title}</h1>
        {auth?.user && <p>{auth.user.displayName || auth.user.email}</p>}
      </div>
      <nav>
        <Link to="/">Sign In</Link>
        <Link to="/admin">Admin</Link>
        {auth?.user.role === "CALEB" && <Link to="/caleb">Caleb</Link>}
        <button onClick={() => { localStorage.removeItem(authKey); window.location.href = "/login"; }}>Log Out</button>
      </nav>
    </header>
  );
}

function RequireLogin({ children, role }: { children: React.ReactNode; role?: Role }) {
  const auth = getAuth();
  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  if (role && auth.user.role !== role) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}

async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const auth = getAuth();

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options.auth !== false && auth?.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }

  const response = await fetch(`${apiBase}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data as T;
}

function getAuth(): { token: string; user: User } | null {
  const raw = localStorage.getItem(authKey);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function toLocalInputValue(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
