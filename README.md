# Workshop Sign-In System

Local-first employee sign-in and timesheet system for a workshop.

The app runs on a Windows PC, stores data in a local SQLite database, and is accessed from a tablet or another device on the same local network.

## Features

- Tablet sign-in page at `/`
- Employee clock in/out with NFC card UID
- 4-digit employee PIN required for breaks and ending shifts
- Status tracking:
  - Off Shift
  - Working
  - Lunch Break
  - Smoke Break
- One lunch break per shift
- Unlimited individually recorded smoke breaks
- Admin view-only page at `/admin`
- Individual printable timesheets at `/admin/employee/:employeeId`
- All staff printable payroll report at `/admin/all`
- Caleb management page at `/caleb`
- Secure local password and PIN hashing
- Monday week start
- Current week plus previous 2 weeks visible
- SQLite database stored locally in `data/workshop.sqlite`

## Important NFC/iPad note

An ACR122U USB NFC reader cannot be read directly by a normal iPad browser. iPad Safari does not expose USB PC/SC readers to local web apps.

Reliable NFC options:

1. Plug the ACR122U into the Windows PC that runs this app.
2. Keep the tablet browser open to the sign-in page over the local network.
3. Place the reader near the sign-in station or use a Windows touch screen/tablet for the reader station.

Alternative: use an Android tablet/browser setup that supports the required NFC/browser integration, or build a separate native iPad app. This project is a local web app, so the supported NFC path is the Windows PC reader.

## Default Caleb login

- Email: `Caleb@westcoastautoair.com.au`
- Password: `1716`

You can override these before first run with environment variables:

```cmd
set CALEB_EMAIL=Caleb@westcoastautoair.com.au
set CALEB_PASSWORD=1716
```

## Local development

Install Node.js on the PC, then run:

```cmd
npm install
npm run dev
```

Open:

- PC: `http://localhost:5173`
- Tablet on same network: `http://PC-IP-ADDRESS:5173`

## Production/local 24-7 run

Build the browser files:

```cmd
npm install
npm run build
npm start
```

Open:

- PC: `http://localhost:3000`
- Tablet on same network: `http://PC-IP-ADDRESS:3000`

Keep the Command Prompt window running, or use Windows Task Scheduler/NSSM to run `npm start` when the PC starts.

## Moving to another PC

Copy the whole project folder to the new PC, including:

- `package.json`
- `package-lock.json`
- `server/`
- `client/`
- `dist/` after running `npm run build`
- `data/` if you want to keep the existing employees and timesheets

Then on the new PC:

```cmd
npm install
npm start
```

## NFC reader setup on Windows

The NFC service is optional so the app can still run without a reader during setup.

To enable an ACR122U reader on the Windows host PC:

1. Install the ACR122U/PCSC driver.
2. Install the optional NFC package on that Windows PC:

   ```cmd
   npm install nfc-pcsc
   ```

3. Start the app with NFC enabled:

   ```cmd
   set NFC_ENABLED=true
   npm start
   ```

If NFC is not enabled, use the built-in reader test panel for setup/testing only.

## Routes

- `/` - tablet sign-in page
- `/login` - management login
- `/admin` - view-only staff status and reports
- `/admin/employee/:employeeId` - individual printable timesheet
- `/admin/all` - all staff printable timesheets
- `/caleb` - employee and timesheet management

## Data security

- Caleb password is hashed locally.
- Employee PINs are hashed locally.
- PINs cannot be viewed after saving; Caleb can reset them.
- No cloud services are used.
