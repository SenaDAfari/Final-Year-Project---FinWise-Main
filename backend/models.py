from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'user'

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    university = db.Column(db.String(100), nullable=False)

    allowance_amount = db.Column(db.Float, default=0.0)
    allowance_frequency = db.Column(db.String(20), default='Monthly')

    # Stores onboarding settings
    categories = db.Column(db.Text, default='[]')

    onboarded = db.Column(db.Boolean, default=False)

    # Optional denormalized goal fields for convenience
    savings_goal_name = db.Column(db.String(100), nullable=True)
    savings_goal_target = db.Column(db.Float, default=0.0)
    savings_goal_deadline = db.Column(db.Date, nullable=True)
    savings_goal_saved = db.Column(db.Float, default=0.0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)


class Expense(db.Model):
    __tablename__ = 'expense'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    date = db.Column(db.Date, nullable=False)
    note = db.Column(db.String(255))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class SavingsGoal(db.Model):
    __tablename__ = 'savings_goal'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    goal_name = db.Column(db.String(100), nullable=False)
    target_amount = db.Column(db.Float, nullable=False)
    saved_amount = db.Column(db.Float, default=0.0)
    deadline = db.Column(db.Date, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class SavingsDeposit(db.Model):
    __tablename__ = 'savings_deposit'

    id = db.Column(db.Integer, primary_key=True)
    goal_id = db.Column(db.Integer, db.ForeignKey('savings_goal.id'), nullable=False)

    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=False)

