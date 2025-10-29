from flask import Blueprint, request, jsonify
from models import db, Department

departments_bp = Blueprint('departments', __name__)

@departments_bp.route('/api/departments', methods=['GET'])
def get_departments():
    departments = Department.query.all()
    return jsonify({
        'success': True,
        'departments': [dept.to_dict() for dept in departments]
    })

@departments_bp.route('/api/departments/<int:dept_id>', methods=['GET'])
def get_department(dept_id):
    department = Department.query.get(dept_id)
    if not department:
        return jsonify({'success': False, 'error': 'Department not found'}), 404

    return jsonify({
        'success': True,
        'department': department.to_dict()
    })

@departments_bp.route('/api/departments', methods=['POST'])
def create_department():
    data = request.get_json()

    if 'name' not in data:
        return jsonify({'success': False, 'error': 'Department name is required'}), 400

    if Department.query.filter_by(name=data['name']).first():
        return jsonify({'success': False, 'error': 'Department with this name already exists'}), 409

    department = Department(name=data['name'])

    db.session.add(department)
    db.session.commit()

    return jsonify({
        'success': True,
        'department': department.to_dict()
    }), 201

@departments_bp.route('/api/departments/<int:dept_id>', methods=['PUT'])
def update_department(dept_id):
    department = Department.query.get(dept_id)
    if not department:
        return jsonify({'success': False, 'error': 'Department not found'}), 404

    data = request.get_json()

    if 'name' in data:
        existing_dept = Department.query.filter_by(name=data['name']).first()
        if existing_dept and existing_dept.id != dept_id:
            return jsonify({'success': False, 'error': 'Department with this name already exists'}), 409
        department.name = data['name']

    db.session.commit()

    return jsonify({
        'success': True,
        'department': department.to_dict()
    })

@departments_bp.route('/api/departments/<int:dept_id>', methods=['DELETE'])
def delete_department(dept_id):
    department = Department.query.get(dept_id)
    if not department:
        return jsonify({'success': False, 'error': 'Department not found'}), 404

    db.session.delete(department)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Department deleted successfully'
    })
