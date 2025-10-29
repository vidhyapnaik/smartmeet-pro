from flask import Flask, jsonify
from flask_cors import CORS
from models import db, Department, User, Room, Booking
from routes.bookings import bookings_bp
from routes.rooms import rooms_bp
from routes.users import users_bp
from routes.departments import departments_bp
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/smartmeet')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret-key-change-in-production')

CORS(app, resources={r"/api/*": {"origins": "*"}})

db.init_app(app)

app.register_blueprint(bookings_bp)
app.register_blueprint(rooms_bp)
app.register_blueprint(users_bp)
app.register_blueprint(departments_bp)

@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        db.session.execute(db.text('SELECT 1'))
        db_status = 'connected'
    except Exception as e:
        db_status = f'error: {str(e)}'

    return jsonify({
        'success': True,
        'status': 'running',
        'database': db_status
    })

@app.route('/api/export/csv', methods=['GET'])
def export_bookings_csv():
    from flask import request, Response
    import csv
    from io import StringIO

    date_str = request.args.get('date')
    if not date_str:
        return jsonify({'success': False, 'error': 'Date parameter required'}), 400

    try:
        date = datetime.strptime(date_str, '%Y-%m-%d').date()
        start_of_day = datetime.combine(date, datetime.min.time())
        end_of_day = datetime.combine(date, datetime.max.time())

        bookings = Booking.query.filter(
            Booking.start_time >= start_of_day,
            Booking.start_time <= end_of_day
        ).order_by(Booking.start_time).all()

        output = StringIO()
        writer = csv.writer(output)

        writer.writerow(['Booking ID', 'Room', 'User', 'Start Time', 'End Time', 'Status', 'Created At'])

        for booking in bookings:
            writer.writerow([
                booking.id,
                booking.room.name if booking.room else '',
                booking.user.name if booking.user else '',
                booking.start_time.strftime('%Y-%m-%d %H:%M'),
                booking.end_time.strftime('%Y-%m-%d %H:%M'),
                booking.status,
                booking.created_at.strftime('%Y-%m-%d %H:%M')
            ])

        output.seek(0)
        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename=bookings_{date_str}.csv'}
        )

    except ValueError:
        return jsonify({'success': False, 'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    from flask import request
    from sqlalchemy import func

    date_str = request.args.get('date')

    if date_str:
        try:
            date = datetime.strptime(date_str, '%Y-%m-%d').date()
            start_of_day = datetime.combine(date, datetime.min.time())
            end_of_day = datetime.combine(date, datetime.max.time())

            bookings_by_room = db.session.query(
                Room.name,
                func.count(Booking.id).label('booking_count')
            ).join(Booking, Booking.room_id == Room.id).filter(
                Booking.start_time >= start_of_day,
                Booking.start_time <= end_of_day
            ).group_by(Room.name).all()

            bookings_by_status = db.session.query(
                Booking.status,
                func.count(Booking.id).label('count')
            ).filter(
                Booking.start_time >= start_of_day,
                Booking.start_time <= end_of_day
            ).group_by(Booking.status).all()

        except ValueError:
            return jsonify({'success': False, 'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    else:
        bookings_by_room = db.session.query(
            Room.name,
            func.count(Booking.id).label('booking_count')
        ).join(Booking, Booking.room_id == Room.id).group_by(Room.name).all()

        bookings_by_status = db.session.query(
            Booking.status,
            func.count(Booking.id).label('count')
        ).group_by(Booking.status).all()

    return jsonify({
        'success': True,
        'analytics': {
            'by_room': [{'room': room, 'count': count} for room, count in bookings_by_room],
            'by_status': [{'status': status, 'count': count} for status, count in bookings_by_status]
        }
    })

def seed_database():
    if Department.query.first():
        print('Database already seeded. Skipping...')
        return

    print('Seeding database...')

    dept_hr = Department(name='Human Resources')
    dept_it = Department(name='Information Technology')
    dept_finance = Department(name='Finance')

    db.session.add_all([dept_hr, dept_it, dept_finance])
    db.session.commit()

    admin_user = User(
        name='Admin User',
        email='admin@smartmeet.com',
        role='admin',
        department_id=dept_it.id
    )

    hr_user = User(
        name='HR Manager',
        email='hr@smartmeet.com',
        role='user',
        department_id=dept_hr.id
    )

    it_user = User(
        name='IT Specialist',
        email='it@smartmeet.com',
        role='user',
        department_id=dept_it.id
    )

    db.session.add_all([admin_user, hr_user, it_user])
    db.session.commit()

    rooms = [
        Room(name='M1', capacity=10, department_access=None, description='General meeting room'),
        Room(name='M2', capacity=6, department_access=dept_hr.id, description='HR private room'),
        Room(name='M3', capacity=8, department_access=None, description='Conference room'),
        Room(name='M4', capacity=4, department_access=dept_it.id, description='IT tech room'),
        Room(name='M5', capacity=12, department_access=None, description='Large boardroom')
    ]

    db.session.add_all(rooms)
    db.session.commit()

    today = datetime.now().date()
    tomorrow = today + timedelta(days=1)

    sample_bookings = [
        Booking(
            room_id=rooms[0].id,
            user_id=admin_user.id,
            start_time=datetime.combine(today, datetime.min.time().replace(hour=10, minute=0)),
            end_time=datetime.combine(today, datetime.min.time().replace(hour=11, minute=0)),
            status='approved'
        ),
        Booking(
            room_id=rooms[2].id,
            user_id=hr_user.id,
            start_time=datetime.combine(today, datetime.min.time().replace(hour=14, minute=0)),
            end_time=datetime.combine(today, datetime.min.time().replace(hour=15, minute=30)),
            status='pending'
        ),
        Booking(
            room_id=rooms[0].id,
            user_id=it_user.id,
            start_time=datetime.combine(tomorrow, datetime.min.time().replace(hour=9, minute=0)),
            end_time=datetime.combine(tomorrow, datetime.min.time().replace(hour=10, minute=0)),
            status='approved'
        )
    ]

    db.session.add_all(sample_bookings)
    db.session.commit()

    print('Database seeded successfully!')
    print(f'Created {len([dept_hr, dept_it, dept_finance])} departments')
    print(f'Created {len([admin_user, hr_user, it_user])} users')
    print(f'Created {len(rooms)} rooms')
    print(f'Created {len(sample_bookings)} sample bookings')

with app.app_context():
    db.create_all()
    seed_database()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
