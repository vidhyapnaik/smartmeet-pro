from flask import Blueprint, request, jsonify
from models import db, Booking, Room, User
from datetime import datetime, timedelta
from sqlalchemy import and_, or_

bookings_bp = Blueprint('bookings', __name__)

def validate_booking_conflict(room_id, start_time, end_time, booking_id=None):
    buffer_minutes = 5
    start_with_buffer = start_time - timedelta(minutes=buffer_minutes)
    end_with_buffer = end_time + timedelta(minutes=buffer_minutes)

    query = Booking.query.filter(
        Booking.room_id == room_id,
        Booking.status != 'rejected',
        or_(
            and_(Booking.start_time <= start_with_buffer, Booking.end_time > start_with_buffer),
            and_(Booking.start_time < end_with_buffer, Booking.end_time >= end_with_buffer),
            and_(Booking.start_time >= start_with_buffer, Booking.end_time <= end_with_buffer)
        )
    )

    if booking_id:
        query = query.filter(Booking.id != booking_id)

    conflicting_booking = query.first()
    return conflicting_booking

def find_next_available_slot(room_id, date, requested_start, duration_minutes=60):
    day_start = datetime.combine(date, datetime.min.time().replace(hour=8))
    day_end = datetime.combine(date, datetime.min.time().replace(hour=20))

    bookings = Booking.query.filter(
        Booking.room_id == room_id,
        Booking.status != 'rejected',
        Booking.start_time >= day_start,
        Booking.start_time < day_end
    ).order_by(Booking.start_time).all()

    current_time = max(requested_start, day_start)
    buffer_minutes = 5

    for booking in bookings:
        potential_end = current_time + timedelta(minutes=duration_minutes)
        if potential_end + timedelta(minutes=buffer_minutes) <= booking.start_time:
            return {
                'start_time': current_time.strftime('%H:%M'),
                'end_time': potential_end.strftime('%H:%M')
            }
        current_time = booking.end_time + timedelta(minutes=buffer_minutes)

    potential_end = current_time + timedelta(minutes=duration_minutes)
    if potential_end <= day_end:
        return {
            'start_time': current_time.strftime('%H:%M'),
            'end_time': potential_end.strftime('%H:%M')
        }

    return None

@bookings_bp.route('/api/bookings', methods=['GET'])
def get_bookings():
    date_str = request.args.get('date')

    if date_str:
        try:
            date = datetime.strptime(date_str, '%Y-%m-%d').date()
            start_of_day = datetime.combine(date, datetime.min.time())
            end_of_day = datetime.combine(date, datetime.max.time())

            bookings = Booking.query.filter(
                Booking.start_time >= start_of_day,
                Booking.start_time <= end_of_day
            ).order_by(Booking.start_time).all()
        except ValueError:
            return jsonify({'success': False, 'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    else:
        bookings = Booking.query.order_by(Booking.start_time.desc()).limit(100).all()

    return jsonify({
        'success': True,
        'bookings': [booking.to_dict() for booking in bookings]
    })

@bookings_bp.route('/api/bookings', methods=['POST'])
def create_booking():
    data = request.get_json()

    required_fields = ['room_id', 'user_id', 'start_time', 'end_time']
    for field in required_fields:
        if field not in data:
            return jsonify({'success': False, 'error': f'Missing required field: {field}'}), 400

    try:
        start_time = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        return jsonify({'success': False, 'error': 'Invalid datetime format. Use ISO 8601 format'}), 400

    if end_time <= start_time:
        return jsonify({'success': False, 'error': 'End time must be after start time'}), 400

    room = Room.query.get(data['room_id'])
    if not room:
        return jsonify({'success': False, 'error': 'Room not found'}), 404

    user = User.query.get(data['user_id'])
    if not user:
        return jsonify({'success': False, 'error': 'User not found'}), 404

    if room.department_access and user.department_id != room.department_access:
        return jsonify({
            'success': False,
            'error': f'Access denied. This room is restricted to {room.department.name} department'
        }), 403

    conflicting_booking = validate_booking_conflict(room.id, start_time, end_time)
    if conflicting_booking:
        duration = int((end_time - start_time).total_seconds() / 60)
        next_slot = find_next_available_slot(room.id, start_time.date(), start_time, duration)

        return jsonify({
            'success': False,
            'error': f'Room already booked between {conflicting_booking.start_time.strftime("%H:%M")}–{conflicting_booking.end_time.strftime("%H:%M")}',
            'next_available': next_slot
        }), 409

    status = 'approved' if user.role == 'admin' else 'pending'

    booking = Booking(
        room_id=data['room_id'],
        user_id=data['user_id'],
        start_time=start_time,
        end_time=end_time,
        status=status
    )

    db.session.add(booking)
    db.session.commit()

    return jsonify({
        'success': True,
        'booking_id': booking.id,
        'status': booking.status,
        'booking': booking.to_dict()
    }), 201

@bookings_bp.route('/api/bookings/<int:booking_id>', methods=['PUT'])
def update_booking(booking_id):
    booking = Booking.query.get(booking_id)
    if not booking:
        return jsonify({'success': False, 'error': 'Booking not found'}), 404

    data = request.get_json()

    if 'status' in data:
        if data['status'] not in ['pending', 'approved', 'rejected']:
            return jsonify({'success': False, 'error': 'Invalid status'}), 400
        booking.status = data['status']

    if 'start_time' in data or 'end_time' in data:
        try:
            start_time = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00')) if 'start_time' in data else booking.start_time
            end_time = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00')) if 'end_time' in data else booking.end_time
        except (ValueError, AttributeError):
            return jsonify({'success': False, 'error': 'Invalid datetime format'}), 400

        if end_time <= start_time:
            return jsonify({'success': False, 'error': 'End time must be after start time'}), 400

        conflicting_booking = validate_booking_conflict(booking.room_id, start_time, end_time, booking_id)
        if conflicting_booking:
            return jsonify({
                'success': False,
                'error': f'Room already booked between {conflicting_booking.start_time.strftime("%H:%M")}–{conflicting_booking.end_time.strftime("%H:%M")}'
            }), 409

        booking.start_time = start_time
        booking.end_time = end_time

    db.session.commit()

    return jsonify({
        'success': True,
        'booking': booking.to_dict()
    })

@bookings_bp.route('/api/bookings/<int:booking_id>', methods=['DELETE'])
def delete_booking(booking_id):
    booking = Booking.query.get(booking_id)
    if not booking:
        return jsonify({'success': False, 'error': 'Booking not found'}), 404

    db.session.delete(booking)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Booking deleted successfully'
    })
