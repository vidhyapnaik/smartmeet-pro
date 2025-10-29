# SmartMeet-Pro Backend

Flask + PostgreSQL backend for SmartMeet-Pro meeting room booking system.

## Features

- Room booking management with conflict detection
- 5-minute buffer enforcement between bookings
- Department-based access control
- Auto-approval for admin users
- Next available slot suggestions
- CSV export and analytics endpoints
- RESTful API with comprehensive error handling

## Tech Stack

- **Flask**: Python web framework
- **SQLAlchemy**: ORM for database operations
- **PostgreSQL**: Primary database
- **Flask-CORS**: Cross-origin resource sharing
- **python-dotenv**: Environment variable management

## Project Structure

```
backend/
├── app.py                 # Main application entry point
├── models.py              # Database models (User, Room, Booking, Department)
├── requirements.txt       # Python dependencies
├── .env.example          # Environment variables template
└── routes/
    ├── bookings.py       # Booking CRUD + validation logic
    ├── rooms.py          # Room management
    ├── users.py          # User management + auth
    └── departments.py    # Department management
```

## Setup Instructions

### Prerequisites

- Python 3.8 or higher
- PostgreSQL 12 or higher
- pip (Python package manager)

### Installation

1. **Navigate to backend directory**

```bash
cd backend
```

2. **Create virtual environment**

```bash
python -m venv venv
```

3. **Activate virtual environment**

**Windows:**
```bash
venv\Scripts\activate
```

**macOS/Linux:**
```bash
source venv/bin/activate
```

4. **Install dependencies**

```bash
pip install -r requirements.txt
```

5. **Configure environment variables**

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
FLASK_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/smartmeet
JWT_SECRET_KEY=your-secret-key-change-this
```

6. **Create PostgreSQL database**

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE smartmeet;

# Exit PostgreSQL
\q
```

### Running the Server

**Local development (localhost only):**

```bash
python app.py
```

**LAN accessible (for demos):**

```bash
flask run --host=0.0.0.0 --port=5000
```

Or modify `app.py` to always bind to `0.0.0.0`:

```python
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

The backend will be available at:
- Local: `http://localhost:5000`
- LAN: `http://<your-ip>:5000` (e.g., `http://192.168.0.10:5000`)

### Database Initialization

The application automatically:
- Creates all database tables on first run
- Seeds initial data (departments, users, rooms, sample bookings)

To reset the database:
1. Drop the database: `DROP DATABASE smartmeet;`
2. Recreate it: `CREATE DATABASE smartmeet;`
3. Restart the Flask server

## API Endpoints

All endpoints return JSON and are prefixed with `/api/`

### Health Check

**GET** `/api/health`

Returns server and database status.

```json
{
  "success": true,
  "status": "running",
  "database": "connected"
}
```

### Authentication

**POST** `/api/auth/login`

Mock login with email only (no password required).

**Request:**
```json
{
  "email": "admin@smartmeet.com"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@smartmeet.com",
    "role": "admin",
    "department_id": 2
  }
}
```

### Bookings

**GET** `/api/bookings?date=YYYY-MM-DD`

List all bookings for a specific date.

**POST** `/api/bookings`

Create new booking with validation.

**Request:**
```json
{
  "room_id": 1,
  "user_id": 1,
  "start_time": "2025-10-29T10:00:00",
  "end_time": "2025-10-29T11:00:00"
}
```

**Success Response:**
```json
{
  "success": true,
  "booking_id": 12,
  "status": "approved",
  "booking": { ... }
}
```

**Conflict Response:**
```json
{
  "success": false,
  "error": "Room already booked between 10:00–11:00",
  "next_available": {
    "start_time": "11:05",
    "end_time": "12:05"
  }
}
```

**PUT** `/api/bookings/<id>`

Update booking (status or time).

**DELETE** `/api/bookings/<id>`

Delete booking (admin only).

### Rooms

**GET** `/api/rooms`

List all rooms.

**POST** `/api/rooms`

Create new room.

**Request:**
```json
{
  "name": "M6",
  "capacity": 15,
  "department_access": 1,
  "description": "Executive boardroom"
}
```

**PUT** `/api/rooms/<id>`

Update room details.

**DELETE** `/api/rooms/<id>`

Delete room.

### Users

**GET** `/api/users`

List all users (admin only).

**POST** `/api/users`

Create new user.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@smartmeet.com",
  "role": "user",
  "department_id": 1
}
```

**PUT** `/api/users/<id>`

Update user.

**DELETE** `/api/users/<id>`

Delete user.

### Departments

**GET** `/api/departments`

List all departments.

**POST** `/api/departments`

Create new department.

**PUT** `/api/departments/<id>`

Update department.

**DELETE** `/api/departments/<id>`

Delete department.

### Analytics & Export

**GET** `/api/analytics?date=YYYY-MM-DD`

Get booking statistics by room and status.

**Response:**
```json
{
  "success": true,
  "analytics": {
    "by_room": [
      {"room": "M1", "count": 5},
      {"room": "M2", "count": 3}
    ],
    "by_status": [
      {"status": "approved", "count": 10},
      {"status": "pending", "count": 2}
    ]
  }
}
```

**GET** `/api/export/csv?date=YYYY-MM-DD`

Export bookings as CSV file.

## Business Logic

### Booking Validation

1. **Overlap Detection**: Prevents double-booking of rooms
2. **5-Minute Buffer**: Enforces gap between consecutive bookings
3. **Department Access**: Users can only book rooms they have access to
4. **Auto-Approval**: Admin bookings auto-approved; others default to pending
5. **Next Available Slot**: Suggests alternative times when requested slot is unavailable

### User Roles

- **admin**: Can approve/reject bookings, full CRUD access
- **approver**: Can approve bookings for their department
- **user**: Can create bookings (require approval)

## Seed Data

The application seeds the following data on first run:

**Departments:**
- Human Resources
- Information Technology
- Finance

**Users:**
- Admin User (admin@smartmeet.com) - Admin role, IT dept
- HR Manager (hr@smartmeet.com) - User role, HR dept
- IT Specialist (it@smartmeet.com) - User role, IT dept

**Rooms:**
- M1: 10 capacity, all departments
- M2: 6 capacity, HR only
- M3: 8 capacity, all departments
- M4: 4 capacity, IT only
- M5: 12 capacity, all departments

## Testing via LAN

To make your backend accessible to other devices on your network:

1. **Find your local IP address**

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" (e.g., 192.168.0.10)

**macOS/Linux:**
```bash
ifconfig | grep "inet "
```

2. **Run backend with host binding**

```bash
flask run --host=0.0.0.0 --port=5000
```

3. **Access from other devices**

Backend: `http://<your-ip>:5000`
Frontend: `http://<your-ip>:5173` (if frontend also running with `--host`)

4. **Firewall Configuration**

Make sure port 5000 is allowed in your firewall:

**Windows:**
```bash
netsh advfirewall firewall add rule name="Flask Server" dir=in action=allow protocol=TCP localport=5000
```

**macOS:**
System Preferences → Security & Privacy → Firewall → Firewall Options → Allow Flask

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FLASK_ENV` | Environment mode | `development` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/smartmeet` |
| `JWT_SECRET_KEY` | Secret key for JWT tokens | `dev-secret-key-change-in-production` |

## Error Handling

All API errors return consistent JSON format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad request
- `403`: Forbidden
- `404`: Not found
- `409`: Conflict

## Troubleshooting

**Database connection error:**
- Verify PostgreSQL is running: `pg_isready`
- Check DATABASE_URL in `.env`
- Ensure database exists: `psql -U postgres -l`

**Port already in use:**
- Change port in `app.py` or use: `flask run --port=5001`

**CORS errors:**
- Verify Flask-CORS is installed
- Check CORS configuration in `app.py`

**Module not found:**
- Activate virtual environment
- Reinstall dependencies: `pip install -r requirements.txt`

## Development Tips

1. **Database Migrations**: For schema changes, use Flask-Migrate:
```bash
pip install flask-migrate
```

2. **API Testing**: Use tools like Postman or curl:
```bash
curl http://localhost:5000/api/health
```

3. **Debug Mode**: Enable detailed error messages in `.env`:
```env
FLASK_ENV=development
```

4. **Log SQL Queries**: Add to `app.py`:
```python
app.config['SQLALCHEMY_ECHO'] = True
```

## Production Considerations

Before deploying to production:

1. Change `JWT_SECRET_KEY` to a secure random string
2. Set `FLASK_ENV=production`
3. Use a production WSGI server (Gunicorn, uWSGI)
4. Enable HTTPS
5. Configure proper database backups
6. Implement rate limiting
7. Add authentication middleware
8. Use environment-specific configuration files

## License

MIT License - see LICENSE file for details
