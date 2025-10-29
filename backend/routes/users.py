from flask import Blueprint, request, jsonify
from models import db, User, Department

users_bp = Blueprint('users', __name__)

@users_bp.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()

    if 'email' not in data:
        return jsonify({'success': False, 'error': 'Email is required'}), 400

    user = User.query.filter_by(email=data['email']).first()

    if not user:
        return jsonify({'success': False, 'error': 'User not found'}), 404

    return jsonify({
        'success': True,
        'user': user.to_dict(),
        'message': 'Login successful'
    })

@users_bp.route('/api/users', methods=['GET'])
def get_users():
    users = User.query.all()
    return jsonify({
        'success': True,
        'users': [user.to_dict() for user in users]
    })

@users_bp.route('/api/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'error': 'User not found'}), 404

    return jsonify({
        'success': True,
        'user': user.to_dict()
    })

@users_bp.route('/api/users', methods=['POST'])
def create_user():
    data = request.get_json()

    required_fields = ['name', 'email']
    for field in required_fields:
        if field not in data:
            return jsonify({'success': False, 'error': f'Missing required field: {field}'}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'success': False, 'error': 'User with this email already exists'}), 409

    role = data.get('role', 'user')
    if role not in ['user', 'admin', 'approver']:
        return jsonify({'success': False, 'error': 'Invalid role. Must be user, admin, or approver'}), 400

    if data.get('department_id'):
        department = Department.query.get(data['department_id'])
        if not department:
            return jsonify({'success': False, 'error': 'Department not found'}), 404

    user = User(
        name=data['name'],
        email=data['email'],
        role=role,
        department_id=data.get('department_id')
    )

    db.session.add(user)
    db.session.commit()

    return jsonify({
        'success': True,
        'user': user.to_dict()
    }), 201

@users_bp.route('/api/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'error': 'User not found'}), 404

    data = request.get_json()

    if 'name' in data:
        user.name = data['name']

    if 'email' in data:
        existing_user = User.query.filter_by(email=data['email']).first()
        if existing_user and existing_user.id != user_id:
            return jsonify({'success': False, 'error': 'User with this email already exists'}), 409
        user.email = data['email']

    if 'role' in data:
        if data['role'] not in ['user', 'admin', 'approver']:
            return jsonify({'success': False, 'error': 'Invalid role'}), 400
        user.role = data['role']

    if 'department_id' in data:
        if data['department_id']:
            department = Department.query.get(data['department_id'])
            if not department:
                return jsonify({'success': False, 'error': 'Department not found'}), 404
        user.department_id = data['department_id']

    db.session.commit()

    return jsonify({
        'success': True,
        'user': user.to_dict()
    })

@users_bp.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'error': 'User not found'}), 404

    db.session.delete(user)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'User deleted successfully'
    })
