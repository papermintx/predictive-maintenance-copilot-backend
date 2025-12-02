# Panduan Penggunaan Postman Collection

## 📋 Daftar Isi
1. [Import Collection](#import-collection)
2. [Setup Authentication](#setup-authentication)
3. [Cara Penggunaan Endpoints](#cara-penggunaan-endpoints)
4. [Testing Workflow](#testing-workflow)

---

## 🚀 Import Collection

### Langkah 1: Import File
1. Buka Postman
2. Klik **Import** di pojok kiri atas
3. Pilih **File** atau drag & drop
4. Select file: `postman/Predictive-Maintenance-API.postman_collection.json`
5. Klik **Import**

### Langkah 2: Verifikasi Import
Pastikan collection **"Predictive Maintenance API"** muncul di sidebar dengan folder:
- ✅ Authentication (10 requests)
- ✅ Machines (6 requests)
- ✅ Sensors (10 requests)
- ✅ Health Check (1 request)
- ✅ Chat (5 requests)
- ✅ Maintenance Tickets (5 requests)
- ✅ Predictions (7 requests)
- ✅ Users (4 requests)

**Total: 48 requests**

---

## 🔐 Setup Authentication

### Auto Authentication (Recommended)

Collection sudah dikonfigurasi dengan **Bearer Token** otomatis menggunakan variable `{{accessToken}}`.

#### Step-by-Step Login:

1. **Expand folder "Authentication"**
2. **Klik "Sign In"**
3. **Edit request body** dengan credentials Anda:
   ```json
   {
     "email": "admin@example.com",
     "password": "yourpassword"
   }
   ```
4. **Klik Send**
5. **Token otomatis tersimpan!** ✨

Script di request akan otomatis menyimpan `accessToken` dan `refreshToken` ke collection variables.

#### Verifikasi Token Tersimpan:
1. Klik icon ⚙️ (settings) di collection
2. Pilih tab **Variables**
3. Pastikan `accessToken` dan `refreshToken` terisi

---

## 📚 Cara Penggunaan Endpoints

### 1️⃣ Authentication Endpoints

#### Sign Up (Register)
```
POST /auth/signup
```
**Body:**
```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "fullName": "John Doe"
}
```

**Response:**
- Email verification akan dikirim
- User perlu verifikasi email sebelum login

#### Sign In (Login)
```
POST /auth/signin
```
**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "refresh_token...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "operator"
  }
}
```

#### Get Profile
```
GET /auth/me
```
Mendapatkan data user yang sedang login.

#### Refresh Token
```
POST /auth/refresh
```
**Body:**
```json
{
  "refreshToken": "{{refreshToken}}"
}
```

#### Sign Out
```
POST /auth/signout
```
Logout user.

---

### 2️⃣ Machines Endpoints

#### Get All Machines
```
GET /machines?limit=50&offset=0&status=operational
```

**Query Parameters:**
- `limit` (optional): Max 100, default 50
- `offset` (optional): For pagination
- `status` (optional): operational, maintenance, offline, error
- `type` (optional): L, M, H

#### Create Machine (Admin/Operator only)
```
POST /machines
```
**Body:**
```json
{
  "productId": "M14860",
  "type": "M",
  "name": "CNC Machine 001",
  "description": "High precision CNC machine",
  "location": "Factory Floor A",
  "installationDate": "2024-01-15T00:00:00Z",
  "status": "operational"
}
```

#### Get Machine by ID
```
GET /machines/:machineId
```

#### Get Machine Statistics
```
GET /machines/:machineId/stats
```
Returns sensor statistics and prediction count.

#### Update Machine (Admin/Operator only)
```
PATCH /machines/:machineId
```
**Body (partial update):**
```json
{
  "status": "maintenance",
  "lastMaintenanceDate": "2025-12-02T00:00:00Z"
}
```

#### Delete Machine (Admin only)
```
DELETE /machines/:machineId
```

---

### 3️⃣ Sensors Endpoints

#### Create Sensor Reading (Admin/Operator only)
```
POST /sensors
```
**Body:**
```json
{
  "machineId": "machine-uuid",
  "productId": "M14860",
  "airTemp": 298.1,
  "processTemp": 308.6,
  "rotationalSpeed": 1551,
  "torque": 42.8,
  "toolWear": 0
}
```

#### Batch Create (Admin/Operator only)
```
POST /sensors/batch
```
**Body:**
```json
{
  "readings": [
    {
      "machineId": "uuid",
      "productId": "M14860",
      "airTemp": 298.1,
      "processTemp": 308.6,
      "rotationalSpeed": 1551,
      "torque": 42.8,
      "toolWear": 0
    }
  ]
}
```
Max 100 readings per request.

#### Get All Sensor Readings
```
GET /sensors?limit=100&machineId=uuid&startDate=2025-12-01&endDate=2025-12-02
```

**Query Parameters:**
- `limit`: Max results (default: 100)
- `offset`: Pagination
- `machineId`: Filter by machine
- `startDate`: ISO date string
- `endDate`: ISO date string

#### Get Sensor Statistics
```
GET /sensors/statistics/:machineId
```
Returns min, max, avg, median for last 100 readings.

#### Simulator Controls (Admin/Operator only)

**Start Simulator:**
```
POST /sensors/simulator/start
```
Generates sensor data every 5 seconds for all operational machines.

**Stop Simulator:**
```
POST /sensors/simulator/stop
```

**Check Status:**
```
GET /sensors/simulator/status
```

**Generate Anomaly:**
```
POST /sensors/simulator/anomaly/:machineId
```
Generate anomaly data for testing (high temperature, unusual speed).

---

### 4️⃣ Chat Endpoints (AI Chatbot)

#### Send Chat Message
```
POST /chat
```
**Body:**
```json
{
  "message": "Bagaimana kondisi mesin M14860 saat ini?"
}
```

**Example Queries:**
- "Mesin mana saja yang berisiko overheat 3 hari kedepan?"
- "Bagaimana kondisi mesin M14860 saat ini?"
- "Mesin di Factory Floor A yang perlu maintenance?"

**Response:**
```json
{
  "role": "assistant",
  "content": "Berdasarkan data sensor terbaru...",
  "createdAt": "2025-12-02T10:00:00.000Z"
}
```

#### Get Chat History
```
GET /chat?limit=50&offset=0
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "role": "user",
      "content": "Bagaimana kondisi mesin?",
      "createdAt": "2025-12-02T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

---

### 5️⃣ Maintenance Tickets Endpoints

#### Create Ticket
```
POST /maintenance-tickets
```
**Body:**
```json
{
  "machineId": "machine-uuid",
  "description": "Bearing temperature exceeding threshold"
}
```

#### Get All Tickets
```
GET /maintenance-tickets
```

#### Get Ticket by ID
```
GET /maintenance-tickets/:ticketId
```

#### Update Ticket Status (Technician role required)
```
PATCH /maintenance-tickets/:ticketId
```
**Body:**
```json
{
  "status": "in_progress"
}
```

**Valid Status:**
- `open`
- `in_progress`
- `closed`
- `canceled`

#### Cancel Ticket
```
PATCH /maintenance-tickets/:ticketId/cancel
```

---

### 6️⃣ Predictions Endpoints

#### Get All Predictions
```
GET /predictions?limit=100&machineId=uuid
```

**Query Parameters:**
- `limit` (optional): Default 100
- `machineId` (optional): Filter by machine

#### Get Statistics
```
GET /predictions/statistics
```

**Response:**
```json
{
  "total": 1250,
  "highRisk": 87,
  "failurePredicted": 45,
  "anomalies": 123,
  "averageRiskScore": 0.42
}
```

#### Get High Risk Predictions
```
GET /predictions/high-risk?threshold=0.7&limit=50
```

**Query Parameters:**
- `threshold`: Risk score threshold (0.0-1.0), default 0.7
- `limit`: Default 50

#### Get Failure Predictions
```
GET /predictions/failures?limit=50
```
Returns predictions where `failurePredicted = true`.

#### Get Anomaly Predictions
```
GET /predictions/anomalies?limit=50
```
Returns predictions where `anomalyDetected = true`.

#### Get Predictions by Machine
```
GET /predictions/machine/:machineId?limit=50
```

#### Get Single Prediction
```
GET /predictions/:id
```

---

### 7️⃣ Users Endpoints (Admin only)

#### Get All Users
```
GET /users
```

**Response:**
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "operator",
    "isActive": true,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

#### Update User
```
PATCH /users/:id
```
**Body (all fields optional):**
```json
{
  "email": "updated@example.com",
  "fullName": "Updated Name",
  "role": "technician"
}
```

Update any combination of user fields: email, fullName, or role.

#### Update User Role Only
```
PATCH /users/:id/role
```
**Body:**
```json
{
  "role": "technician"
}
```

**Valid Roles:**
- `admin` - Full access
- `operator` - Can manage machines & sensors
- `technician` - Can update maintenance tickets
- `viewer` - Read-only access

#### Activate User
```
PATCH /users/:id/activate
```
Sets `isActive = true`.

#### Deactivate User
```
PATCH /users/:id/deactivate
```
Sets `isActive = false`. User cannot login when deactivated.

---

## 🔄 Testing Workflow

### Basic Workflow

1. **Login terlebih dahulu:**
   - Authentication → Sign In
   - Token otomatis tersimpan

2. **Test endpoints sesuai role:**

   **Admin:**
   - ✅ All endpoints

   **Operator:**
   - ✅ Machines (CRUD)
   - ✅ Sensors (CRUD + Simulator)
   - ✅ Maintenance Tickets (Create, Read)
   - ✅ Predictions (Read)
   - ✅ Chat

   **Technician:**
   - ✅ Maintenance Tickets (Update status)
   - ✅ Machines (Read)
   - ✅ Sensors (Read)
   - ✅ Predictions (Read)

   **Viewer:**
   - ✅ Read-only access untuk semua endpoints

3. **Refresh token jika expired:**
   - Authentication → Refresh Token

---

### Complete Testing Scenario

#### Scenario 1: Machine Monitoring

```
1. GET /machines
   → Dapatkan list machines

2. GET /machines/:id/stats
   → Lihat statistik machine

3. GET /sensors?machineId=xxx
   → Lihat sensor readings

4. GET /predictions/machine/:id
   → Lihat prediction history
```

#### Scenario 2: Predictive Maintenance

```
1. GET /predictions/statistics
   → Overview predictions

2. GET /predictions/high-risk
   → Machines dengan risk tinggi

3. POST /maintenance-tickets
   → Create ticket untuk machine berisiko

4. PATCH /maintenance-tickets/:id
   → Update status ticket
```

#### Scenario 3: Anomaly Detection

```
1. POST /sensors/simulator/start
   → Start sensor simulator

2. POST /sensors/simulator/anomaly/:machineId
   → Generate anomaly data

3. GET /predictions/anomalies
   → Lihat anomaly predictions

4. POST /chat
   Message: "Mesin mana yang anomaly terdeteksi?"
   → AI analysis
```

#### Scenario 4: User Management (Admin)

```
1. GET /users
   → List all users

2. PATCH /users/:id/role
   Body: { "role": "technician" }
   → Change user role

3. PATCH /users/:id/deactivate
   → Deactivate user
```

---

## 🔍 Troubleshooting

### 401 Unauthorized
**Penyebab:**
- Token expired
- Token tidak valid
- Belum login

**Solusi:**
1. Login ulang: Authentication → Sign In
2. Atau refresh token: Authentication → Refresh Token

### 403 Forbidden
**Penyebab:**
- Role tidak memiliki akses

**Solusi:**
- Pastikan user memiliki role yang sesuai
- Admin dapat mengubah role: Users → Update User Role

### 404 Not Found
**Penyebab:**
- Resource ID tidak ditemukan
- URL salah

**Solusi:**
- Cek ID yang digunakan
- Verifikasi resource exists dengan GET all

### 500 Internal Server Error
**Penyebab:**
- Server error
- Database connection issue

**Solusi:**
- Cek server logs
- Pastikan database running
- Restart server jika perlu

---

## 📝 Tips & Best Practices

### 1. Environment Variables
Gunakan Postman Environments untuk multiple configs:
- Development: `http://localhost:3000`
- Staging: `https://staging-api.example.com`
- Production: `https://api.example.com`

### 2. Save Response as Example
Setelah request success:
1. Klik **Save Response**
2. Pilih **Save as Example**
3. Berguna untuk dokumentasi

### 3. Test Scripts
Collection sudah include test scripts untuk auto-save tokens.
Lihat tab **Tests** di request untuk melihat/edit scripts.

### 4. Pre-request Scripts
Gunakan untuk:
- Generate dynamic data
- Set timestamps
- Calculate values

### 5. Collection Runner
Test multiple requests sekaligus:
1. Klik **Runner**
2. Select collection/folder
3. Klik **Run**

---

## 📊 Response Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Success |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Not authorized |
| 404 | Not Found | Resource not found |
| 500 | Server Error | Internal error |

---

## 🎯 Quick Reference

### Required Roles by Endpoint

| Endpoint Group | Admin | Operator | Technician | Viewer |
|----------------|-------|----------|------------|--------|
| Authentication | ✅ | ✅ | ✅ | ✅ |
| Machines (Read) | ✅ | ✅ | ✅ | ✅ |
| Machines (Write) | ✅ | ✅ | ❌ | ❌ |
| Sensors (Read) | ✅ | ✅ | ✅ | ✅ |
| Sensors (Write) | ✅ | ✅ | ❌ | ❌ |
| Simulator | ✅ | ✅ | ❌ | ❌ |
| Predictions | ✅ | ✅ | ✅ | ✅ |
| Tickets (Read) | ✅ | ✅ | ✅ | ✅ |
| Tickets (Write) | ✅ | ✅ | ✅ | ❌ |
| Chat | ✅ | ✅ | ✅ | ✅ |
| Users | ✅ | ❌ | ❌ | ❌ |

---

## 💡 Advanced Usage

### Batch Testing with CSV
1. Siapkan CSV file dengan test data
2. Collection Runner → Select Data File
3. Use `{{variable}}` dari CSV columns

### Mock Server
1. Right-click collection → Mock Collection
2. Dapat test frontend tanpa backend running

### Monitor & Schedule
1. Postman Monitors
2. Schedule API tests
3. Get notifications on failures

---

## 📞 Support

Jika menemukan issues:
1. Cek logs di terminal server
2. Verify database connection
3. Check Postman console untuk request details

Happy Testing! 🚀
