# 🛠️ Developer Guide - Predictive Maintenance API

Dokumentasi API untuk Frontend Developer.

## 📋 Table of Contents

- [Authentication Flow](#authentication-flow)
- [API Endpoints](#api-endpoints)
- [Error Handling](#error-handling)
- [Common Exceptions](#common-exceptions)
- [Security Notes](#security-notes)

---

## 🔐 Authentication Flow

### Complete Authentication Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ 1. SIGN UP                                                  │
└─────────────────────────────────────────────────────────────┘
POST /auth/signup
  ↓
User created in Supabase (email not verified)
  ↓
Email sent automatically
  ↓
Session = null (cannot sign in yet)


┌─────────────────────────────────────────────────────────────┐
│ 2. EMAIL VERIFICATION                                        │
└─────────────────────────────────────────────────────────────┘
User clicks link in email
  ↓
Browser opens: /auth/verify-email#access_token=...
  ↓
JavaScript parses hash fragment
  ↓
POST /auth/verify-email/callback { accessToken }
  ↓
Backend creates user in local DB
  ↓
Email verified ✅


┌─────────────────────────────────────────────────────────────┐
│ 3. SIGN IN                                                   │
└─────────────────────────────────────────────────────────────┘
POST /auth/signin
  ↓
Returns { accessToken, refreshToken }
  ↓
Store tokens in localStorage/sessionStorage


┌─────────────────────────────────────────────────────────────┐
│ 4. AUTHENTICATED REQUESTS                                    │
└─────────────────────────────────────────────────────────────┘
GET /auth/me
Headers: { Authorization: "Bearer <accessToken>" }
  ↓
Backend validates token with Supabase
  ↓
Returns user data


┌─────────────────────────────────────────────────────────────┐
│ 5. SIGN OUT                                                  │
└─────────────────────────────────────────────────────────────┘
POST /auth/signout
Headers: { Authorization: "Bearer <accessToken>" }
  ↓
Session invalidated in Supabase
  ↓
Token becomes invalid immediately
  ↓
Clear tokens from storage
```

---

## 📡 API Endpoints

### Base URL

```
Development: http://localhost:3000
Production: https://your-domain.com
```

---

## 🏭 Machine Management API

### 1. Create Machine

**Endpoint:** `POST /machines`  
**Auth:** Required (Admin, Operator)

**Request:**
```json
{
  "productId": "L47181",
  "type": "L",
  "name": "Machine L47181",
  "description": "Low quality variant machine",
  "location": "Factory Floor 2",
  "installationDate": "2023-02-06",
  "lastMaintenanceDate": "2024-06-22",
  "status": "operational"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "productId": "L47181",
  "type": "L",
  "name": "Machine L47181",
  "description": "Low quality variant machine",
  "location": "Factory Floor 2",
  "installationDate": "2023-02-06T00:00:00.000Z",
  "lastMaintenanceDate": "2024-06-22T00:00:00.000Z",
  "status": "operational",
  "createdAt": "2025-11-12T00:00:00.000Z",
  "updatedAt": "2025-11-12T00:00:00.000Z"
}
```

---

### 2. Get All Machines

**Endpoint:** `GET /machines`  
**Auth:** Required (All roles)

**Query Parameters:**
- `search` (optional) - Search by name, productId, or location
- `type` (optional) - Filter by type: L, M, H
- `status` (optional) - Filter by status: operational, maintenance, offline, retired
- `location` (optional) - Filter by location
- `includeStats` (optional) - Include sensor readings count (true/false)
- `limit` (optional) - Results per page (default: 50)
- `offset` (optional) - Pagination offset (default: 0)

**Example:** `GET /machines?type=L&status=operational&limit=10`

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "productId": "L47181",
      "type": "L",
      "name": "Machine L47181",
      "status": "operational",
      "_count": {
        "sensorReadings": 150
      }
    }
  ],
  "meta": {
    "total": 100,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

---

### 3. Get Machine by ID

**Endpoint:** `GET /machines/:id`  
**Auth:** Required (All roles)

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "productId": "L47181",
  "type": "L",
  "name": "Machine L47181",
  "description": "Low quality variant machine",
  "location": "Factory Floor 2",
  "installationDate": "2023-02-06T00:00:00.000Z",
  "lastMaintenanceDate": "2024-06-22T00:00:00.000Z",
  "status": "operational",
  "_count": {
    "sensorReadings": 150
  },
  "createdAt": "2025-11-12T00:00:00.000Z",
  "updatedAt": "2025-11-12T00:00:00.000Z"
}
```

---

### 4. Get Machine Statistics

**Endpoint:** `GET /machines/:id/stats`  
**Auth:** Required (All roles)

**Response:** `200 OK`
```json
{
  "machine": {
    "id": "uuid",
    "productId": "L47181",
    "name": "Machine L47181",
    "status": "operational"
  },
  "statistics": {
    "sensorReadingsCount": 150,
    "predictionsCount": 0,
    "criticalPredictions": 0,
    "latestPrediction": null
  }
}
```

---

### 5. Update Machine

**Endpoint:** `PATCH /machines/:id`  
**Auth:** Required (Admin, Operator)

**Request:** (All fields optional)
```json
{
  "name": "Updated Machine Name",
  "status": "maintenance",
  "location": "Factory Floor 3",
  "lastMaintenanceDate": "2025-11-12"
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "productId": "L47181",
  "name": "Updated Machine Name",
  "status": "maintenance",
  "updatedAt": "2025-11-12T00:00:00.000Z"
}
```

---

### 6. Delete Machine

**Endpoint:** `DELETE /machines/:id`  
**Auth:** Required (Admin only)

**Response:** `200 OK`
```json
{
  "message": "Machine deleted successfully"
}
```

---

## 📊 Sensors API

### 1. Create Sensor Reading

**Endpoint:** `POST /sensors`  
**Auth:** Required (Admin, Operator)

**Request:**
```json
{
  "machineId": "uuid",
  "productId": "L47181",
  "airTemp": 298.5,
  "processTemp": 308.2,
  "rotationalSpeed": 1450,
  "torque": 42.3,
  "toolWear": 85,
  "timestamp": "2025-11-12T10:30:00Z"
}
```

**Response:** `201 Created`
```json
{
  "udi": 123,
  "machineId": "uuid",
  "productId": "L47181",
  "airTemp": 298.5,
  "processTemp": 308.2,
  "rotationalSpeed": 1450,
  "torque": 42.3,
  "toolWear": 85,
  "timestamp": "2025-11-12T10:30:00.000Z"
}
```

---

### 2. Create Batch Sensor Readings

**Endpoint:** `POST /sensors/batch`  
**Auth:** Required (Admin, Operator)

**Request:** (Max 100 readings per request)
```json
{
  "readings": [
    {
      "machineId": "uuid",
      "productId": "L47181",
      "airTemp": 298.5,
      "processTemp": 308.2,
      "rotationalSpeed": 1450,
      "torque": 42.3,
      "toolWear": 85,
      "timestamp": "2025-11-12T10:30:00Z"
    },
    {
      "machineId": "uuid",
      "productId": "L47181",
      "airTemp": 299.1,
      "processTemp": 308.8,
      "rotationalSpeed": 1460,
      "torque": 43.1,
      "toolWear": 86,
      "timestamp": "2025-11-12T10:31:00Z"
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "count": 2,
  "message": "Successfully created 2 sensor readings"
}
```

---

### 3. Get Sensor Readings

**Endpoint:** `GET /sensors`  
**Auth:** Required (All roles)

**Query Parameters:**
- `machineId` (optional) - Filter by machine
- `startDate` (optional) - Filter by start date (ISO 8601)
- `endDate` (optional) - Filter by end date (ISO 8601)
- `limit` (optional) - Results per page (default: 100, max: 1000)
- `offset` (optional) - Pagination offset (default: 0)

**Example:** `GET /sensors?machineId=uuid&startDate=2025-11-01&limit=50`

**Response:** `200 OK`
```json
{
  "data": [
    {
      "udi": 123,
      "machineId": "uuid",
      "productId": "L47181",
      "airTemp": 298.5,
      "processTemp": 308.2,
      "rotationalSpeed": 1450,
      "torque": 42.3,
      "toolWear": 85,
      "timestamp": "2025-11-12T10:30:00.000Z"
    }
  ],
  "meta": {
    "total": 500,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

---

### 4. Get Sensor Reading by UDI

**Endpoint:** `GET /sensors/:udi`  
**Auth:** Required (All roles)

**Response:** `200 OK`
```json
{
  "udi": 123,
  "machineId": "uuid",
  "productId": "L47181",
  "airTemp": 298.5,
  "processTemp": 308.2,
  "rotationalSpeed": 1450,
  "torque": 42.3,
  "toolWear": 85,
  "timestamp": "2025-11-12T10:30:00.000Z",
  "machine": {
    "id": "uuid",
    "productId": "L47181",
    "name": "Machine L47181",
    "type": "L",
    "status": "operational"
  }
}
```

---

### 5. Get Sensor Statistics

**Endpoint:** `GET /sensors/statistics/:machineId`  
**Auth:** Required (All roles)

**Query Parameters:**
- `limit` (optional) - Number of recent readings to analyze (default: 100)

**Response:** `200 OK`
```json
{
  "machineId": "uuid",
  "readingsAnalyzed": 100,
  "statistics": {
    "airTemp": {
      "min": 295.2,
      "max": 302.5,
      "avg": 298.5,
      "median": 298.3
    },
    "processTemp": {
      "min": 305.1,
      "max": 312.8,
      "avg": 308.2,
      "median": 308.0
    },
    "rotationalSpeed": {
      "min": 1200,
      "max": 1600,
      "avg": 1450,
      "median": 1455
    },
    "torque": {
      "min": 30.5,
      "max": 50.2,
      "avg": 42.3,
      "median": 42.1
    },
    "toolWear": {
      "min": 0,
      "max": 200,
      "avg": 85,
      "median": 82
    }
  }
}
```

---

### 6. Delete Sensor Reading

**Endpoint:** `DELETE /sensors/:udi`  
**Auth:** Required (Admin only)

**Response:** `200 OK`
```json
{
  "message": "Sensor reading deleted successfully"
}
```

---

## 🔐 Authentication API

### 1. Sign Up (Registration)

**Endpoint:** `POST /auth/signup`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "John Doe"
}
```

**Validation:**
- `email`: Valid email format, required
- `password`: Min 6 characters, required
- `fullName`: Optional

**Success Response (201):**
```json
{
  "message": "User created successfully. Please check your email to verify your account.",
  "user": {
    "email": "user@example.com"
  },
  "session": null
}
```

**Error Responses:**

| Status | Error | Reason |
|--------|-------|--------|
| 400 | Bad Request | Invalid email/password format |
| 409 | Conflict | Email already registered |
| 500 | Internal Server Error | Database/Supabase error |

---

### 2. Email Verification

#### GET `/auth/verify-email`
- Returns HTML page dengan JavaScript
- Dipanggil otomatis dari link email
- Parse token dari URL hash fragment

#### POST `/auth/verify-email/callback`

**Request:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "refresh_token_here",
  "type": "signup"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "email": "user@example.com"
}
```

**Error Responses:**

| Status | Error | Reason |
|--------|-------|--------|
| 401 | Unauthorized | Invalid/expired token |
| 400 | Bad Request | Missing access token |

---

### 3. Resend Verification Email

**Endpoint:** `POST /auth/resend-verification`

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "message": "Verification email has been resent. Please check your inbox."
}
```

**Error Responses:**

| Status | Error | Reason |
|--------|-------|--------|
| 400 | Bad Request | Invalid email |
| 404 | Not Found | Email not registered |
| 429 | Too Many Requests | Rate limit exceeded |

---

### 4. Sign In (Login)

**Endpoint:** `POST /auth/signin`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "message": "Sign in successful",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "USER"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "4e3c8f9a-b2d1-4a7c-9e6f-1d8c3b7a5e2f",
  "expiresIn": 3600
}
```

**Error Responses:**

| Status | Error | Reason |
|--------|-------|--------|
| 401 | Unauthorized | Invalid credentials / Email not verified |
| 400 | Bad Request | Missing email/password |
| 403 | Forbidden | Account inactive |

> 💡 **Note:** Store `accessToken` dan `refreshToken` di localStorage untuk request selanjutnya.

---

### 5. Get Profile (Me)

**Endpoint:** `GET /auth/me`

**Authentication:** Required ✅

**Headers:**
```json
{
  "Authorization": "Bearer <accessToken>"
}
```

**Success Response (200):**
```json
{
  "id": 1,
  "supabaseId": "uuid...",
  "email": "user@example.com",
  "fullName": "John Doe",
  "role": "USER",
  "isActive": true,
  "createdAt": "2025-11-11T00:00:00.000Z",
  "updatedAt": "2025-11-11T00:00:00.000Z"
}
```

**Error Responses:**

| Status | Error | Reason |
|--------|-------|--------|
| 401 | Unauthorized | Missing/Invalid token |
| 401 | Unauthorized | Session invalidated (after sign out) |
| 403 | Forbidden | Account inactive |

---

### 6. Refresh Token

**Endpoint:** `POST /auth/refresh`

**Request:**
```json
{
  "refreshToken": "4e3c8f9a-b2d1-4a7c-9e6f-1d8c3b7a5e2f"
}
```

**Success Response (200):**
```json
{
  "message": "Token refreshed successfully",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "new-refresh-token-here",
  "expiresIn": 3600
}
```

**Error Responses:**

| Status | Error | Reason |
|--------|-------|--------|
| 401 | Unauthorized | Invalid/expired refresh token |
| 400 | Bad Request | Missing refresh token |

---

### 7. Sign Out (Logout)

**Endpoint:** `POST /auth/signout`

**Authentication:** Required ✅

**Headers:**
```json
{
  "Authorization": "Bearer <accessToken>"
}
```

**Success Response (200):**
```json
{
  "message": "Sign out successful"
}
```

> ⚠️ **Important:** Token langsung invalid setelah sign out. Clear tokens dari storage dan redirect ke sign in.

---

### 8. Reset Password

**Endpoint:** `POST /auth/reset-password`

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "message": "Password reset email sent. Please check your inbox."
}
```

**Error Responses:**

| Status | Error | Reason |
|--------|-------|--------|
| 400 | Bad Request | Invalid email |
| 404 | Not Found | Email not registered |
| 429 | Too Many Requests | Rate limit exceeded |

---

## 🚨 Error Handling

### Standard Error Response Format

```json
{
  "statusCode": 400,
  "timestamp": "2025-11-11T12:00:00.000Z",
  "path": "/auth/signin",
  "method": "POST",
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

### Error Status Codes

| Code | Name | Description | Action |
|------|------|-------------|--------|
| 400 | Bad Request | Invalid input/validation failed | Fix request data |
| 401 | Unauthorized | Missing/invalid authentication | Sign in again |
| 403 | Forbidden | No permission | Check user role |
| 404 | Not Found | Resource not found | Check endpoint |
| 409 | Conflict | Resource already exists | Use different data |
| 429 | Too Many Requests | Rate limit exceeded | Wait and retry |
| 500 | Internal Server Error | Server error | Retry or contact support |

---

## ⚠️ Common Exceptions

### 1. Email Not Verified
**Error:** `401 - Please verify your email before signing in`
**Action:** Show resend verification email option

### 2. Session Invalidated
**Error:** `401 - Session has been invalidated`
**Action:** Clear storage, redirect to sign in

### 3. Token Expired
**Error:** `401 - Unauthorized`
**Action:** Try refresh token, if failed redirect to sign in

### 4. Rate Limit Exceeded
**Error:** `429 - Too many requests`
**Action:** Show wait time message, disable button temporarily

---

## 🔒 Security Notes

### Token Storage
- ✅ Use `localStorage` untuk SPA
- ❌ Jangan store di cookies tanpa httpOnly flag
- ❌ Jangan expose token di URL

### Token Management
- Check token expiry sebelum request
- Implement auto-refresh mechanism menggunakan interceptor
- Clear tokens dari storage setelah sign out
- Validate token di server untuk setiap protected endpoint

### Best Practices
- Always use HTTPS di production
- Implement CORS dengan whitelist domains
- Set token expiry sesuai kebutuhan (default: 1 hour)
- Implement rate limiting untuk prevent abuse

---

## 📞 Testing

### Postman Collection
Import collection dari `postman/Predictive-Maintenance-API.postman_collection.json` untuk testing semua endpoints.

### Testing Flow
1. Sign Up → Check email
2. Verify Email → Click link di email
3. Sign In → Simpan access token
4. Get Profile → Test dengan token
5. Sign Out → Test token jadi invalid
6. Try Get Profile → Harus return 401

---

## 🔌 WebSocket Real-time API

### Overview

WebSocket API menyediakan real-time updates untuk sensor data dan predictions menggunakan Socket.IO. Data dikirim secara real-time setiap kali ada perubahan di database.

### Connection Setup

**WebSocket Namespace:** `/sensors`  
**URL:** `ws://localhost:3000/sensors` (Development)

---

### Authentication

WebSocket menggunakan JWT token yang sama dengan REST API untuk authentication.

**Socket.IO Client Setup:**
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000/sensors', {
  auth: {
    token: accessToken  // Your JWT access token from sign in
  }
});
```

**Without Authentication:**
- Connection akan di-reject
- Error: `Authentication error`

---

### Connection Events

#### 1. Connect
Emitted ketika connection berhasil established.

```javascript
socket.on('connect', () => {
  console.log('Connected to WebSocket');
  console.log('Socket ID:', socket.id);
});
```

#### 2. Disconnect
Emitted ketika connection terputus.

```javascript
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  
  // Reasons:
  // - 'io server disconnect' = Server forced disconnect
  // - 'io client disconnect' = Client manually disconnect
  // - 'transport close' = Network issue
  // - 'transport error' = Network error
});
```

#### 3. Connect Error
Emitted ketika connection gagal.

```javascript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
  
  // Common errors:
  // - 'Authentication error' = Invalid/missing token
  // - 'Session invalidated' = Token revoked after sign out
});
```

#### 4. Error
Emitted untuk error lainnya.

```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

---

### Subscription Events

#### 1. Subscribe to Single Machine Sensor

**Event:** `subscribe:sensor`

**Emit:**
```javascript
socket.emit('subscribe:sensor', {
  machineId: 'uuid-of-machine'
});
```

**Response:** `subscribed`
```javascript
socket.on('subscribed', (data) => {
  console.log('Subscribed:', data);
  // Output: { machineId: "uuid-of-machine" }
});
```

**Receive Updates:** `sensor:update`
```javascript
socket.on('sensor:update', (data) => {
  console.log('Sensor update:', data);
  
  // Data format:
  // {
  //   udi: 123,
  //   machine_id: "uuid-of-machine",
  //   product_id: "L47181",
  //   air_temp: 298.5,
  //   process_temp: 308.2,
  //   rotational_speed: 1450,
  //   torque: 42.3,
  //   tool_wear: 85,
  //   timestamp: "2025-11-22T10:30:00.000Z"
  // }
  
  updateSensorDisplay(data);
});
```

---

#### 2. Subscribe to All Sensors

**Event:** `subscribe:all-sensors`

**Emit:**
```javascript
socket.emit('subscribe:all-sensors');
```

**Response:** `subscribed`
```javascript
socket.on('subscribed', (data) => {
  console.log('Subscribed to all sensors:', data);
  // Output: { all: true }
});
```

**Receive Updates:** `sensors:update`
```javascript
socket.on('sensors:update', (data) => {
  console.log('Sensors update (all machines):', data);
  
  // Data format sama dengan sensor:update
  // {
  //   udi: 124,
  //   machine_id: "uuid-of-any-machine",
  //   product_id: "M14860",
  //   air_temp: 299.1,
  //   process_temp: 309.5,
  //   rotational_speed: 1520,
  //   torque: 45.2,
  //   tool_wear: 92,
  //   timestamp: "2025-11-22T10:30:05.000Z"
  // }
  
  updateAllSensors(data);
});
```

---

#### 3. Unsubscribe

**Event:** `unsubscribe`

Unsubscribe dari semua room yang sudah di-subscribe.

**Emit:**
```javascript
socket.emit('unsubscribe');
```

**Response:** No response, silent success

---

### Complete Frontend Example

```javascript
// ==========================================
// WebSocket Manager Class
// ==========================================

class WebSocketManager {
  constructor() {
    this.socket = null;
    this.accessToken = localStorage.getItem('accessToken');
    this.subscribedMachines = new Set();
  }

  // Connect to WebSocket
  connect() {
    if (!this.accessToken) {
      console.error('No access token found');
      return;
    }

    this.socket = io('http://localhost:3000/sensors', {
      auth: { token: this.accessToken }
    });

    this.setupEventHandlers();
  }

  // Setup all event handlers
  setupEventHandlers() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.onConnect();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      this.onDisconnect(reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('🚨 Connection error:', error.message);
      this.onConnectError(error);
    });

    // Subscription confirmation
    this.socket.on('subscribed', (data) => {
      console.log('✅ Subscribed:', data);
    });

    // Data updates
    this.socket.on('sensor:update', (data) => {
      this.handleSensorUpdate(data);
    });

    this.socket.on('sensors:update', (data) => {
      this.handleSensorsUpdate(data);
    });
  }

  // Subscribe to single machine
  subscribeToMachine(machineId) {
    if (!this.socket || !this.socket.connected) {
      console.error('Socket not connected');
      return;
    }

    this.socket.emit('subscribe:sensor', { machineId });
    this.subscribedMachines.add(machineId);
  }

  // Subscribe to all sensors
  subscribeToAllSensors() {
    if (!this.socket || !this.socket.connected) {
      console.error('Socket not connected');
      return;
    }

    this.socket.emit('subscribe:all-sensors');
  }

  // Unsubscribe from all
  unsubscribe() {
    if (!this.socket || !this.socket.connected) {
      return;
    }

    this.socket.emit('unsubscribe');
    this.subscribedMachines.clear();
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.subscribedMachines.clear();
    }
  }

  // Event handlers (customize these)
  onConnect() {
    // Update UI status
    document.getElementById('wsStatus').textContent = 'Connected';
    document.getElementById('wsStatus').className = 'status-connected';
  }

  onDisconnect(reason) {
    // Update UI status
    document.getElementById('wsStatus').textContent = 'Disconnected';
    document.getElementById('wsStatus').className = 'status-disconnected';

    // Auto-reconnect if not intentional disconnect
    if (reason !== 'io client disconnect') {
      console.log('Attempting to reconnect...');
    }
  }

  onConnectError(error) {
    // Show error to user
    if (error.message === 'Authentication error') {
      alert('Session expired. Please sign in again.');
      window.location.href = '/login';
    }
  }

  handleSensorUpdate(data) {
    // Transform snake_case to camelCase for frontend
    const sensorData = {
      udi: data.udi,
      machineId: data.machine_id,
      productId: data.product_id,
      airTemp: data.air_temp,
      processTemp: data.process_temp,
      rotationalSpeed: data.rotational_speed,
      torque: data.torque,
      toolWear: data.tool_wear,
      timestamp: data.timestamp
    };

    // Update UI for specific machine
    this.updateMachineSensorDisplay(sensorData);
  }

  handleSensorsUpdate(data) {
    // Same transformation as handleSensorUpdate
    const sensorData = {
      udi: data.udi,
      machineId: data.machine_id,
      productId: data.product_id,
      airTemp: data.air_temp,
      processTemp: data.process_temp,
      rotationalSpeed: data.rotational_speed,
      torque: data.torque,
      toolWear: data.tool_wear,
      timestamp: data.timestamp
    };

    // Update UI for any machine
    this.updateSensorReadings(sensorData);
  }

  updateMachineSensorDisplay(data) {
    // Example: Update specific machine card
    const card = document.getElementById(`machine-${data.machineId}`);
    if (card) {
      card.querySelector('.air-temp').textContent = data.airTemp.toFixed(1);
      card.querySelector('.process-temp').textContent = data.processTemp.toFixed(1);
      card.querySelector('.rpm').textContent = data.rotationalSpeed;
      card.querySelector('.torque').textContent = data.torque.toFixed(1);
      card.querySelector('.tool-wear').textContent = data.toolWear;
      card.querySelector('.last-update').textContent = new Date(data.timestamp).toLocaleString();
    }
  }

  updateSensorReadings(data) {
    // Example: Add to sensor readings list
    const grid = document.getElementById('sensorReadingsGrid');
    const card = this.createSensorCard(data);
    
    // Add new card or update existing
    const existingCard = grid.querySelector(`[data-machine-id="${data.machineId}"]`);
    if (existingCard) {
      existingCard.replaceWith(card);
    } else {
      grid.appendChild(card);
    }
  }

  createSensorCard(data) {
    const card = document.createElement('div');
    card.className = 'sensor-card';
    card.dataset.machineId = data.machineId;
    
    card.innerHTML = `
      <div class="card-header">
        <strong>📊 ${data.productId}</strong>
        <span class="badge">UDI: ${data.udi}</span>
      </div>
      <div class="metrics-grid">
        <div class="metric">
          <label>Air Temp</label>
          <value>${data.airTemp.toFixed(1)} K</value>
        </div>
        <div class="metric">
          <label>Process Temp</label>
          <value>${data.processTemp.toFixed(1)} K</value>
        </div>
        <div class="metric">
          <label>Speed</label>
          <value>${data.rotationalSpeed} RPM</value>
        </div>
        <div class="metric">
          <label>Torque</label>
          <value>${data.torque.toFixed(1)} Nm</value>
        </div>
        <div class="metric">
          <label>Tool Wear</label>
          <value>${data.toolWear} min</value>
        </div>
      </div>
      <div class="card-footer">
        <small>Last update: ${new Date(data.timestamp).toLocaleString()}</small>
      </div>
    `;
    
    return card;
  }

  updateMachineStatus(machineId, prediction) {
    const statusBadge = document.getElementById(`status-${machineId}`);
    if (statusBadge && prediction.riskLevel === 'high') {
      statusBadge.className = 'badge badge-danger';
      statusBadge.textContent = 'High Risk';
    }
  }

  showPredictionAlert(data) {
    // Show notification
    if (Notification.permission === 'granted') {
      new Notification('⚠️ Predictive Maintenance Alert', {
        body: `${data.failureType} detected on machine ${data.machineId}`,
        icon: '/alert-icon.png'
      });
    }

    // Show in-app alert
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger';
    alert.innerHTML = `
      <strong>⚠️ ${data.failureType}</strong><br>
      Machine: ${data.machineId}<br>
      Risk Level: ${data.riskLevel}<br>
      Confidence: ${(data.confidence * 100).toFixed(1)}%
    `;
    document.getElementById('alerts-container').prepend(alert);
  }
}

// ==========================================
// Usage Example
// ==========================================

// Initialize WebSocket manager
const wsManager = new WebSocketManager();

// Connect on page load (after login)
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    wsManager.connect();
    
    // Subscribe to all sensors for dashboard
    wsManager.subscribeToAllSensors();
  }
});

// Subscribe to specific machine when viewing details
function viewMachineDetails(machineId) {
  // Navigate to detail page
  window.location.href = `/machines/${machineId}`;
  
  // Subscribe to this machine
  wsManager.subscribeToMachine(machineId);
  wsManager.subscribeToPrediction(machineId);
}

// Cleanup on logout
function logout() {
  wsManager.disconnect();
  localStorage.removeItem('accessToken');
  window.location.href = '/login';
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  wsManager.disconnect();
});
```

---

### React Example

```typescript
// hooks/useWebSocket.ts
import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';

interface SensorData {
  udi: number;
  machineId: string;
  productId: string;
  airTemp: number;
  processTemp: number;
  rotationalSpeed: number;
  torque: number;
  toolWear: number;
  timestamp: string;
}

interface PredictionData {
  id: number;
  machineId: string;
  predictedFailure: boolean;
  failureType: string;
  confidence: number;
  riskLevel: string;
  predictedAt: string;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [latestSensor, setLatestSensor] = useState<SensorData | null>(null);
  const [latestPrediction, setLatestPrediction] = useState<PredictionData | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    // Connect
    socketRef.current = io('http://localhost:3000/sensors', {
      auth: { token }
    });

    const socket = socketRef.current;

    // Event handlers
    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    socket.on('sensor:update', (data: any) => {
      setLatestSensor({
        udi: data.udi,
        machineId: data.machine_id,
        productId: data.product_id,
        airTemp: data.air_temp,
        processTemp: data.process_temp,
        rotationalSpeed: data.rotational_speed,
        torque: data.torque,
        toolWear: data.tool_wear,
        timestamp: data.timestamp
      });
    });

    socket.on('sensors:update', (data: any) => {
      setLatestSensor({
        udi: data.udi,
        machineId: data.machine_id,
        productId: data.product_id,
        airTemp: data.air_temp,
        processTemp: data.process_temp,
        rotationalSpeed: data.rotational_speed,
        torque: data.torque,
        toolWear: data.tool_wear,
        timestamp: data.timestamp
      });
    });

    // Cleanup
    return () => {
      socket.disconnect();
    };
  }, []);

  const subscribeToMachine = (machineId: string) => {
    socketRef.current?.emit('subscribe:sensor', { machineId });
  };

  const subscribeToAllSensors = () => {
    socketRef.current?.emit('subscribe:all-sensors');
  };

  const unsubscribe = () => {
    socketRef.current?.emit('unsubscribe');
  };

  return {
    isConnected,
    latestSensor,
    subscribeToMachine,
    subscribeToAllSensors,
    unsubscribe
  };
}
}

// Usage in component
function Dashboard() {
  const { 
    isConnected, 
    latestSensor, 
    subscribeToAllSensors 
  } = useWebSocket();

  useEffect(() => {
    if (isConnected) {
      subscribeToAllSensors();
    }
  }, [isConnected]);

  return (
    <div>
      <div>Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</div>
      {latestSensor && (
        <div>
          <h3>Latest Sensor Reading</h3>
          <p>Machine: {latestSensor.productId}</p>
          <p>Air Temp: {latestSensor.airTemp.toFixed(1)} K</p>
          <p>Process Temp: {latestSensor.processTemp.toFixed(1)} K</p>
          <p>Speed: {latestSensor.rotationalSpeed} RPM</p>
          <p>Torque: {latestSensor.torque.toFixed(1)} Nm</p>
          <p>Tool Wear: {latestSensor.toolWear} min</p>
        </div>
      )}
    </div>
  );
}
```

---

### Sensor Simulator API

**Start Simulator:**
```javascript
POST /sensors/simulator/start
Headers: { Authorization: "Bearer <token>" }
```

**Stop Simulator:**
```javascript
POST /sensors/simulator/stop
Headers: { Authorization: "Bearer <token>" }
```

**Check Status:**
```javascript
GET /sensors/simulator/status
Headers: { Authorization: "Bearer <token>" }
```

**Generate Anomaly (Testing):**
```javascript
POST /sensors/simulator/anomaly/:machineId
Headers: { Authorization: "Bearer <token>" }
```

> 💡 **Note:** Simulator menghasilkan sensor data setiap 5 detik dan broadcast via WebSocket secara real-time.

---

### Data Format Reference

#### Sensor Data (from WebSocket)
```typescript
{
  udi: number;              // Unique Data Identifier
  machine_id: string;       // Machine UUID (snake_case from DB)
  product_id: string;       // Product ID (e.g., "L47181")
  air_temp: number;         // Air temperature in Kelvin
  process_temp: number;     // Process temperature in Kelvin
  rotational_speed: number; // RPM
  torque: number;           // Torque in Nm
  tool_wear: number;        // Tool wear in minutes
  timestamp: string;        // ISO 8601 timestamp
}
```

#### Prediction Data (from WebSocket)
```typescript
{
  id: number;
  machineId: string;
  predictedFailure: boolean;
  failureType: string;      // e.g., "Heat Dissipation Failure"
  confidence: number;       // 0.0 - 1.0
  riskLevel: string;        // "low" | "medium" | "high" | "critical"
  predictedAt: string;      // ISO 8601 timestamp
}
```

---

### Best Practices

#### 1. Connection Management
- ✅ Connect WebSocket after successful login
- ✅ Disconnect on logout or page unload
- ✅ Handle reconnection automatically
- ❌ Don't create multiple connections

#### 2. Subscription Management
- ✅ Subscribe only to data you need
- ✅ Unsubscribe when leaving page/component
- ✅ Use `subscribe:all-sensors` for dashboard
- ✅ Use `subscribe:sensor` for detail pages

#### 3. Error Handling
- ✅ Handle `connect_error` for auth issues
- ✅ Show connection status to user
- ✅ Implement retry logic with exponential backoff
- ✅ Clear tokens and redirect on auth errors

#### 4. Performance
- ✅ Use efficient data structures (Map, Set)
- ✅ Debounce rapid UI updates
- ✅ Limit number of subscriptions
- ❌ Don't subscribe to all machines individually

#### 5. Security
- ✅ Always pass valid JWT token
- ✅ Validate token expiry before connecting
- ✅ Clear sensitive data on disconnect
- ❌ Don't expose tokens in console logs

---

### Troubleshooting

#### Connection Fails
**Problem:** `connect_error: Authentication error`
**Solution:** 
- Check if token is valid
- Ensure token is passed in `auth.token`
- Try refreshing token or sign in again

#### No Data Received
**Problem:** Connected but no `sensor:update` events
**Solution:**
- Ensure you called `subscribe:sensor` or `subscribe:all-sensors`
- Check if simulator is running (`POST /sensors/simulator/start`)
- Check server logs for Supabase Realtime issues

#### Multiple Updates
**Problem:** Receiving duplicate events
**Solution:**
- Check if you're subscribing multiple times
- Call `unsubscribe` before re-subscribing
- Use `subscribeToAllSensors()` only once

#### Memory Leaks
**Problem:** Browser performance degrades over time
**Solution:**
- Always disconnect socket on unmount (React) or page unload
- Remove event listeners properly
- Clear data structures (Maps, Sets) on cleanup

---

**Happy Real-time Coding! 🚀**
