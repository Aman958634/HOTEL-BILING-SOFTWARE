# RestoSphere Run Guide (Step by Step)

This guide helps you run the project without server crashes and common terminal errors.

## 1. Prerequisites

- Node.js installed
- MongoDB installed (`mongod` command available)
- Project path:
  - `C:\Users\AMAN\Desktop\Hotel Biling`

## 2. Environment Check

### Backend env
File: `server/.env`

Required values:

```env
NODE_ENV=development
PORT=5002
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb://127.0.0.1:27017/restaurant_management
JWT_ACCESS_SECRET=dev_access_secret_change_me
JWT_REFRESH_SECRET=dev_refresh_secret_change_me
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
```

### Frontend env
File: `client/.env`

```env
VITE_API_URL=http://localhost:5002/api/v1
VITE_SOCKET_URL=http://localhost:5002
```

## 3. Install Dependencies (one time)

Open terminal at project root and run:

```powershell
cd "C:\Users\AMAN\Desktop\Hotel Biling\server"
npm install

cd "C:\Users\AMAN\Desktop\Hotel Biling\client"
npm install
```

## 4. Start MongoDB (Terminal 1)

```powershell
"C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath "C:\Users\AMAN\Desktop\Hotel Biling\.mongodb\data" --bind_ip 127.0.0.1 --port 27017
```

Keep this terminal running.

## 5. Start Backend (Terminal 2)

```powershell
cd "C:\Users\AMAN\Desktop\Hotel Biling\server"
npm run dev
```

Expected output:

- `MongoDB connected: 127.0.0.1`
- `Server running on port 5002`

## 6. Start Frontend (Terminal 3)

```powershell
cd "C:\Users\AMAN\Desktop\Hotel Biling\client"
npm run dev
```

Expected output:

- `Local: http://localhost:5173/`

## 7. Open Website

- Public site: `http://localhost:5173`
- Register: `http://localhost:5173/register`
- Login: `http://localhost:5173/login`

## 8. Admin Login

Use admin credentials:

- Email: `admin@restosphere.com`
- Password: `Admin@12345`

Admin dashboard route:

- `http://localhost:5173/dashboard/admin`

## 9. Super Admin Login

Use super admin credentials:

- Email: `superadmin@restosphere.com`
- Password: `SuperAdmin@12345`

Super admin login route:

- `http://localhost:5173/super-admin-login`

Super admin dashboard route:

- `http://localhost:5173/super-admin/dashboard`

## 10. If You See Errors

### A) `EADDRINUSE` (port already in use)

This project auto-cleans ports in dev scripts, but if still needed:

```powershell
Get-NetTCPConnection -LocalPort 5002,5173 -State Listen
```

Then stop conflicting process manually:

```powershell
Stop-Process -Id <PID> -Force
```

Restart backend/frontend.

### B) `Request failed with status code 422`

Registration validation failed. Ensure:

- full name not empty
- valid email
- phone exactly 10 digits
- password minimum 8 characters

### C) `Session expired` / `jwt expired`

This is not a server crash now. Do this:

1. Logout and login again
2. If needed, clear browser token:
   - DevTools -> Application -> Local Storage -> remove `accessToken`
3. Login again

### D) `Network Error`

Check:

- MongoDB running on `27017`
- Backend running on `5002`
- Frontend running on `5173`
- `client/.env` has correct `VITE_API_URL`

### E) PowerShell `PSReadLine` crash (`System.ArgumentOutOfRangeException`)

If terminal shows:

- `Oops, something went wrong. Please report this bug...`
- `Microsoft.PowerShell.PSConsoleReadLine`

Then this is a PowerShell console rendering bug, not your Node/React app crash.

Use these fixes:

1. Open a fresh terminal and run:

```powershell
Remove-Module PSReadLine
```

2. Avoid pasting very long one-line commands in PowerShell.
3. Prefer simple separate commands (login, then API call), or use Command Prompt for long pasted commands.
4. Restart VS Code terminal if needed.

Quick login test (safe, short):

```powershell
$body = '{"email":"admin@restosphere.com","password":"Admin@12345"}'
Invoke-RestMethod -Method Post -Uri "http://localhost:5002/api/v1/auth/login" -ContentType "application/json" -Body $body
```

## 10. Quick Health Check Commands

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:5002/api/v1/health"
```

Should return:

```json
{"success":true,"message":"Server is healthy"}
```

## 11. Notes

- Keep all 3 terminals open while developing:
  - MongoDB
  - Backend
  - Frontend
- If frontend env changes, restart frontend dev server.
- If you change `client/.env`, fully restart frontend (`Ctrl+C` then `npm run dev`).
