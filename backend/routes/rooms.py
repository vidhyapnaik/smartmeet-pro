from flask import Blueprint, request, jsonify
from models import db, Room, Department

rooms_bp = Blueprint('rooms', __name__)

@rooms_bp.route('/api/rooms', methods=['GET'])
def get_rooms():
    rooms = Room.query.all()
    return jsonify({
        'success': True,
        'rooms': [room.to_dict() for room in rooms]
    })

@rooms_bp.route('/api/rooms/<int:room_id>', methods=['GET'])
def get_room(room_id):
    room = Room.query.get(room_id)
    if not room:
        return jsonify({'success': False, 'error': 'Room not found'}), 404

    return jsonify({
        'success': True,
        'room': room.to_dict()
    })

@rooms_bp.route('/api/rooms', methods=['POST'])
def create_room():
    data = request.get_json()

    required_fields = ['name', 'capacity']
    for field in required_fields:
        if field not in data:
            return jsonify({'success': False, 'error': f'Missing required field: {field}'}), 400

    if Room.query.filter_by(name=data['name']).first():
        return jsonify({'success': False, 'error': 'Room with this name already exists'}), 409

    if data.get('department_access'):
        department = Department.query.get(data['department_access'])
        if not department:
            return jsonify({'success': False, 'error': 'Department not found'}), 404

    room = Room(
        name=data['name'],
        capacity=data['capacity'],
        department_access=data.get('department_access'),
        description=data.get('description', '')
    )

    db.session.add(room)
    db.session.commit()

    return jsonify({
        'success': True,
        'room': room.to_dict()
    }), 201

@rooms_bp.route('/api/rooms/<int:room_id>', methods=['PUT'])
def update_room(room_id):
    room = Room.query.get(room_id)
    if not room:
        return jsonify({'success': False, 'error': 'Room not found'}), 404

    data = request.get_json()

    if 'name' in data:
        existing_room = Room.query.filter_by(name=data['name']).first()
        if existing_room and existing_room.id != room_id:
            return jsonify({'success': False, 'error': 'Room with this name already exists'}), 409
        room.name = data['name']

    if 'capacity' in data:
        room.capacity = data['capacity']

    if 'department_access' in data:
        if data['department_access']:
            department = Department.query.get(data['department_access'])
            if not department:
                return jsonify({'success': False, 'error': 'Department not found'}), 404
        room.department_access = data['department_access']

    if 'description' in data:
        room.description = data['description']

    db.session.commit()

    return jsonify({
        'success': True,
        'room': room.to_dict()
    })

@rooms_bp.route('/api/rooms/<int:room_id>', methods=['DELETE'])
def delete_room(room_id):
    room = Room.query.get(room_id)
    if not room:
        return jsonify({'success': False, 'error': 'Room not found'}), 404

    db.session.delete(room)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Room deleted successfully'
    })
