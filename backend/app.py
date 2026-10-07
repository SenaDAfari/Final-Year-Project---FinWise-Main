from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from datetime import datetime, timedelta
from calendar import monthrange
import os, random, string
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix

load_dotenv()

# The built React app (output of `npm run build`) is copied into ./static so one
# server can host both the API and the website.
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')
# Behind a host's reverse proxy, trust one hop so the login rate limiter sees the real client IP.
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
CORS(app, origins=os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(','))

# Use DATABASE_URL (e.g. a hosted Postgres) when set; fall back to local SQLite for development.
_db_url = os.getenv('DATABASE_URL', 'sqlite:///finwise.db')
if _db_url.startswith('postgres://'):  # legacy scheme emitted by some hosts
    _db_url = _db_url.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = _db_url
if not _db_url.startswith('sqlite'):
    # Serverless Postgres drops idle connections; test them before use and recycle regularly.
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {'pool_pre_ping': True, 'pool_recycle': 280}
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
_jwt_secret = os.getenv('JWT_SECRET_KEY')
if not _jwt_secret:
    raise RuntimeError('JWT_SECRET_KEY is not set. Add it to backend/.env')
app.config['JWT_SECRET_KEY'] = _jwt_secret
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)

GROQ_MODEL = os.getenv('GROQ_MODEL', 'openai/gpt-oss-120b')
GROQ_EXTRA = {'reasoning_effort': 'low', 'include_reasoning': False}
GROQ_FALLBACK_MODELS = [GROQ_MODEL, 'llama-3.1-8b-instant', 'gemma2-9b-it']
GROQ_TIMEOUT_SECONDS = float(os.getenv('GROQ_TIMEOUT_SECONDS', 20))
MAX_HISTORY_TURNS = 6

def call_groq(messages, max_tokens, timeout=GROQ_TIMEOUT_SECONDS):
    """Try GROQ_MODEL first, then fall back through GROQ_FALLBACK_MODELS."""
    from groq import Groq
    client = Groq(api_key=os.getenv('GROQ_API_KEY'), timeout=timeout)
    last_err = None
    for model in GROQ_FALLBACK_MODELS:
        try:
            res = client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                **GROQ_EXTRA
            )
            return res.choices[0].message.content
        except Exception as e:
            last_err = e
            print(f"GROQ MODEL '{model}' FAILED: {e}")
            continue
    raise last_err

def sanitize_history(raw_history):
    """Validates and normalizes a client-supplied conversation history."""
    if not isinstance(raw_history, list):
        return []
    cleaned = []
    for turn in raw_history[-(MAX_HISTORY_TURNS * 2):]:
        if not isinstance(turn, dict):
            continue
        role = turn.get('role')
        text = turn.get('text')
        if role not in ('user', 'ai', 'assistant'):
            continue
        if not text or not isinstance(text, str):
            continue
        mapped_role = 'assistant' if role in ('ai', 'assistant') else 'user'
        cleaned.append({'role': mapped_role, 'content': text.strip()[:2000]})
    return cleaned

db = SQLAlchemy(app)
jwt = JWTManager(app)

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],
    storage_uri="memory://"
)

# ── MODELS ────────────────────────────────────────────────────────────────────

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    university = db.Column(db.String(100))
    allowance_amount = db.Column(db.Float, default=0)
    allowance_frequency = db.Column(db.String(20), default='Monthly')
    semester_months = db.Column(db.Integer, default=1)
    monthly_budget = db.Column(db.Float, default=0)
    onboarded = db.Column(db.Boolean, default=False)
    categories = db.Column(db.String(500), default='')
    payday_date = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(100), nullable=False)
    date = db.Column(db.String(20), nullable=False)
    note = db.Column(db.String(300), default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class SavingsGoal(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    goal_name = db.Column(db.String(100), nullable=False)
    target_amount = db.Column(db.Float, nullable=False)
    saved_amount = db.Column(db.Float, default=0)
    deadline = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class SavingsDeposit(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    goal_id = db.Column(db.Integer, db.ForeignKey('savings_goal.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.String(20), nullable=False)

class CategoryLimit(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    monthly_limit = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# ── VALIDATION HELPERS ───────────────────────────────────────────────────────

class ValidationError(Exception):
    def __init__(self, message):
        self.message = message

@app.errorhandler(ValidationError)
def handle_validation_error(err):
    return jsonify({'error': err.message}), 400

@app.errorhandler(404)
def handle_not_found(err):
    index_file = os.path.join(FRONTEND_DIR, 'index.html')
    if (request.method == 'GET' and not request.path.startswith('/api/')
            and os.path.isfile(index_file)):
        # Let React Router handle pages such as /dashboard on refresh
        return send_from_directory(FRONTEND_DIR, 'index.html')
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(Exception)
def handle_unexpected_error(err):
    from werkzeug.exceptions import HTTPException
    if isinstance(err, HTTPException):
        return jsonify({'error': err.description}), err.code
    print(f"UNHANDLED ERROR: {err}")
    db.session.rollback()
    return jsonify({'error': 'Something went wrong. Please try again.'}), 500

def require_fields(data, fields):
    if not isinstance(data, dict):
        raise ValidationError('Request body must be JSON')
    missing = [f for f in fields if not str(data.get(f, '')).strip()]
    if missing:
        raise ValidationError(f"Missing required field(s): {', '.join(missing)}")

def parse_positive_amount(value, field_name='amount'):
    try:
        amount = float(value)
    except (TypeError, ValueError):
        raise ValidationError(f'{field_name} must be a number')
    if amount <= 0:
        raise ValidationError(f'{field_name} must be greater than 0')
    if amount > 10_000_000:
        raise ValidationError(f'{field_name} is unrealistically large')
    return round(amount, 2)

def parse_date(value, field_name='date'):
    if not value:
        raise ValidationError(f'{field_name} is required')
    try:
        datetime.strptime(value, '%Y-%m-%d')
    except ValueError:
        raise ValidationError(f'{field_name} must be in YYYY-MM-DD format')
    return value

def validate_transaction_date(value, user, field_name='date'):
    """Stricter check for actual transaction records (expenses, deposits) on
    top of parse_date's format check. Rejects future dates and dates before
    the account existed — bad dates here would silently corrupt 'this month'
    totals, streaks, and the historical averages used by the Limits page's
    trend/suggestion features. Deliberately NOT applied to forward-looking
    config fields like next_payday or a savings goal deadline, which are
    supposed to be in the future."""
    parse_date(value, field_name)
    d = datetime.strptime(value, '%Y-%m-%d').date()
    today = datetime.now().date()
    if d > today:
        raise ValidationError(f'{field_name} cannot be in the future')
    if user and user.created_at:
        account_start = user.created_at.date() - timedelta(days=1)  # small grace for timezone edge cases
        if d < account_start:
            raise ValidationError(f'{field_name} cannot be before your account was created')
    return value

def parse_semester_months(value):
    try:
        months = int(value)
    except (TypeError, ValueError):
        raise ValidationError('semester_months must be a whole number')
    if months < 1 or months > 12:
        raise ValidationError('semester_months must be between 1 and 12')
    return months

def parse_category(value, allowed=None):
    if not value or not str(value).strip():
        raise ValidationError('category is required')
    category = str(value).strip()
    if allowed is not None and category not in allowed:
        raise ValidationError('Unknown category')
    return category

# ── AUTH ──────────────────────────────────────────────────────────────────────

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    require_fields(data, ['full_name', 'email', 'password'])
    email = str(data['email']).strip().lower()
    if '@' not in email or '.' not in email.split('@')[-1]:
        raise ValidationError('Please enter a valid email address')
    if len(data['password']) < 6:
        raise ValidationError('Password must be at least 6 characters')
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409
    user = User(
        full_name=str(data['full_name']).strip(),
        email=email,
        password_hash=generate_password_hash(data['password']),
        university=data.get('university', '')
    )
    db.session.add(user)
    db.session.commit()
    token = create_access_token(identity=str(user.id))
    return jsonify({
        'token': token,
        'user': {
            'id': user.id,
            'full_name': user.full_name,
            'email': user.email,
            'university': user.university,
            'onboarded': user.onboarded
        }
    }), 201

@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    data = request.get_json(silent=True) or {}
    require_fields(data, ['email', 'password'])
    email = str(data['email']).strip().lower()
    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({'error': 'Invalid email or password'}), 401
    token = create_access_token(identity=str(user.id))
    return jsonify({
        'token': token,
        'user': {
            'id': user.id,
            'full_name': user.full_name,
            'email': user.email,
            'university': user.university,
            'onboarded': user.onboarded
        }
    })

@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_me():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({
        'id': user.id,
        'full_name': user.full_name,
        'email': user.email,
        'university': user.university,
        'onboarded': user.onboarded,
        'allowance_amount': user.allowance_amount,
        'allowance_frequency': user.allowance_frequency,
        'monthly_budget': user.monthly_budget,
        'semester_months': user.semester_months,
        'categories': user.categories.split(',') if user.categories else [],
        'next_payday': user.payday_date
    })

# ── ONBOARDING ────────────────────────────────────────────────────────────────

@app.route('/api/onboarding', methods=['POST'])
@jwt_required()
def onboarding():
    user = User.query.get(int(get_jwt_identity()))
    data = request.get_json(silent=True) or {}
    require_fields(data, ['allowance_amount', 'allowance_frequency'])

    user.allowance_amount = parse_positive_amount(data.get('allowance_amount'), 'allowance_amount')
    frequency = data.get('allowance_frequency')
    # ── CHANGED: added 'Bi-weekly' to the accepted set of allowance frequencies ──
    if frequency not in ('Monthly', 'Weekly', 'Bi-weekly', 'Per Semester'):
        raise ValidationError("allowance_frequency must be 'Monthly', 'Weekly', 'Bi-weekly' or 'Per Semester'")
    user.allowance_frequency = frequency

    categories = data.get('categories', [])
    if not isinstance(categories, list) or not categories:
        raise ValidationError('Select at least one spending category')
    user.categories = ','.join(str(c).strip() for c in categories)
    user.onboarded = True

    if user.allowance_frequency == 'Per Semester':
        months = parse_semester_months(data.get('semester_months', 4))
        user.semester_months = months
        user.monthly_budget = round(user.allowance_amount / months, 2)
    elif user.allowance_frequency == 'Weekly':
        user.monthly_budget = round(user.allowance_amount * 4, 2)
        user.semester_months = 1
    # ── CHANGED: Bi-weekly budget math — two payments per month on average ──
    elif user.allowance_frequency == 'Bi-weekly':
        user.monthly_budget = round(user.allowance_amount * 2, 2)
        user.semester_months = 1
    else:
        user.monthly_budget = user.allowance_amount
        user.semester_months = 1

    next_payday = data.get('next_payday')
    user.payday_date = parse_date(next_payday, 'next_payday') if next_payday else None

    if data.get('goal_name') and data.get('target_amount'):
        existing_goal = SavingsGoal.query.filter_by(user_id=user.id).order_by(SavingsGoal.id.asc()).first()
        if not existing_goal:
            goal = SavingsGoal(
                user_id=user.id,
                goal_name=str(data['goal_name']).strip(),
                target_amount=parse_positive_amount(data['target_amount'], 'target_amount'),
                deadline=data.get('deadline', '')
            )
            db.session.add(goal)

    db.session.commit()
    return jsonify({'message': 'Onboarding complete'})

@app.route('/api/settings/income', methods=['POST'])
@jwt_required()
def update_income():
    user = User.query.get(int(get_jwt_identity()))
    data = request.get_json(silent=True) or {}

    try:
        if 'allowance_amount' in data:
            user.allowance_amount = parse_positive_amount(data['allowance_amount'], 'allowance_amount')
        if 'allowance_frequency' in data:
            frequency = data['allowance_frequency']
            # ── CHANGED: added 'Bi-weekly' to the accepted set of allowance frequencies ──
            if frequency not in ('Monthly', 'Weekly', 'Bi-weekly', 'Per Semester'):
                raise ValidationError("allowance_frequency must be 'Monthly', 'Weekly', 'Bi-weekly' or 'Per Semester'")
            user.allowance_frequency = frequency
        if 'categories' in data:
            categories = data['categories']
            if not isinstance(categories, list) or not categories:
                raise ValidationError('Select at least one spending category')
            user.categories = ','.join(str(c).strip() for c in categories)

        if user.allowance_frequency == 'Per Semester':
            months = parse_semester_months(data.get('semester_months', user.semester_months or 4))
            user.semester_months = months
            user.monthly_budget = round(user.allowance_amount / months, 2)
        elif user.allowance_frequency == 'Weekly':
            user.monthly_budget = round(user.allowance_amount * 4, 2)
            user.semester_months = 1
        # ── CHANGED: Bi-weekly budget math — two payments per month on average ──
        elif user.allowance_frequency == 'Bi-weekly':
            user.monthly_budget = round(user.allowance_amount * 2, 2)
            user.semester_months = 1
        else:
            user.monthly_budget = user.allowance_amount
            user.semester_months = 1

        if 'next_payday' in data:
            next_payday = data['next_payday']
            user.payday_date = parse_date(next_payday, 'next_payday') if next_payday else None

        db.session.commit()
        return jsonify({
            'message': 'Income updated',
            'monthly_budget': user.monthly_budget,
            'allowance_amount': user.allowance_amount,
            'allowance_frequency': user.allowance_frequency,
            'semester_months': user.semester_months,
            'categories': user.categories.split(',') if user.categories else [],
            'next_payday': user.payday_date
        })
    except ValidationError:
        db.session.rollback()
        raise
    except Exception as e:
        print(f"INCOME UPDATE ERROR: {e}")
        db.session.rollback()
        return jsonify({'error': 'Could not update income settings'}), 500

# ── DASHBOARD ─────────────────────────────────────────────────────────────────

def calculate_streak(user):
    monthly_budget = user.monthly_budget or user.allowance_amount
    if monthly_budget <= 0:
        return 0

    today = datetime.now().date()
    days_in_month = monthrange(today.year, today.month)[1]
    daily_budget = monthly_budget / days_in_month

    registered_date = user.created_at.date() if user.created_at else today
    if registered_date > today:
        registered_date = today

    all_exp = Expense.query.filter_by(user_id=user.id).all()
    spend_by_date = {}
    for e in all_exp:
        spend_by_date[e.date] = spend_by_date.get(e.date, 0) + e.amount

    streak = 0
    day = today - timedelta(days=1)
    while day >= registered_date:
        day_total = spend_by_date.get(day.strftime('%Y-%m-%d'), 0)
        if day_total <= daily_budget:
            streak += 1
            day -= timedelta(days=1)
        else:
            break

    return streak

def add_months(d, months):
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    day = min(d.day, monthrange(year, month)[1])
    return d.replace(year=year, month=month, day=day)


def get_next_payday(user, today):
    if not user.payday_date:
        return None
    anchor = datetime.strptime(user.payday_date, '%Y-%m-%d').date()
    frequency = user.allowance_frequency
    if frequency == 'Weekly':
        while anchor < today:
            anchor += timedelta(days=7)
    # ── CHANGED: Bi-weekly payday rolls forward in 14-day steps ──
    elif frequency == 'Bi-weekly':
        while anchor < today:
            anchor += timedelta(days=14)
    elif frequency == 'Per Semester':
        step = user.semester_months or 4
        while anchor < today:
            anchor = add_months(anchor, step)
    else:
        while anchor < today:
            anchor = add_months(anchor, 1)
    return anchor


def get_cycle_length_days(user, cycle_end):
    """Length in days of the current allowance cycle ending at cycle_end,
    used to work out the student's normal daily rate."""
    frequency = user.allowance_frequency
    if frequency == 'Weekly':
        cycle_start = cycle_end - timedelta(days=7)
    elif frequency == 'Bi-weekly':
        cycle_start = cycle_end - timedelta(days=14)
    elif frequency == 'Per Semester':
        step = user.semester_months or 4
        cycle_start = add_months(cycle_end, -step)
    else:
        cycle_start = add_months(cycle_end, -1)
    return max(1, (cycle_end - cycle_start).days)


@app.route('/api/dashboard', methods=['GET'])
@jwt_required()
def dashboard():
    user = User.query.get(int(get_jwt_identity()))
    month_str = datetime.now().strftime('%Y-%m')
    all_exp = Expense.query.filter_by(user_id=user.id).all()
    month_exp = [e for e in all_exp if e.date.startswith(month_str)]
    total = sum(e.amount for e in month_exp)
    cats = {}
    for e in month_exp:
        cats[e.category] = cats.get(e.category, 0) + e.amount
    recent = sorted(all_exp, key=lambda x: (x.date, x.id), reverse=True)[:5]
    recent_savings = [e for e in _get_log_entries(user.id) if e['type'] == 'saving'][:2]
    goal = SavingsGoal.query.filter_by(user_id=user.id).order_by(SavingsGoal.id.asc()).first()
    all_goals = _user_goals(user.id)

    monthly_budget = user.monthly_budget or user.allowance_amount
    remaining = monthly_budget - total
    percent_used = (total / monthly_budget * 100) if monthly_budget > 0 else 0

    today = datetime.now()
    next_payday = get_next_payday(user, today.date())
    if next_payday:
        days_left = max(1, (next_payday - today.date()).days)
        cycle_length = get_cycle_length_days(user, next_payday)
    else:
        days_in_month = monthrange(today.year, today.month)[1]
        days_left = days_in_month - today.day + 1
        cycle_length = days_in_month
    daily_budget = remaining / days_left if days_left > 0 else 0
    normal_daily_rate = monthly_budget / cycle_length if cycle_length > 0 else 0
    # Survival mode: today's remaining daily allowance has fallen below half
    # the student's normal daily rate — a days-left-aware signal rather than
    # a flat percentage of the total budget.
    survival_mode = monthly_budget > 0 and daily_budget < normal_daily_rate * 0.5
    days_elapsed = today.day
    daily_spend_rate = total / days_elapsed if days_elapsed > 0 else 0
    days_until_broke = remaining / daily_spend_rate if daily_spend_rate > 0 else days_left

    limits = CategoryLimit.query.filter_by(user_id=user.id).all()
    limit_status = {}
    for l in limits:
        spent = cats.get(l.category, 0)
        percent = (spent / l.monthly_limit * 100) if l.monthly_limit > 0 else 0
        limit_status[l.category] = {
            'limit': l.monthly_limit,
            'spent': round(spent, 2),
            'percent': round(percent, 1),
            'status': 'exceeded' if percent >= 100 else 'warning' if percent >= 80 else 'ok'
        }

    return jsonify({
        'income': user.allowance_amount,
        'monthly_budget': monthly_budget,
        'total_expenses': total,
        'remaining_balance': remaining,
        'percent_used': round(percent_used, 1),
        'survival_mode': survival_mode,
        'daily_budget': round(daily_budget, 2),
        'days_left': days_left,
        'days_until_broke': round(days_until_broke, 1),
        'allowance_frequency': user.allowance_frequency,
        'semester_months': user.semester_months,
        'next_payday': next_payday.strftime('%Y-%m-%d') if next_payday else None,
        'category_breakdown': cats,
        'limit_status': limit_status,
        'streak': calculate_streak(user),
        'recent_transactions': [
            {'id': e.id, 'category': e.category, 'amount': e.amount, 'date': e.date, 'note': e.note}
            for e in recent
        ],
        'recent_savings': [
            {'id': d['id'], 'goal_name': d['goal_name'], 'amount': d['amount'], 'date': d['date']}
            for d in recent_savings
        ],
        'savings_goal': {
            'goal_name': goal.goal_name,
            'target_amount': goal.target_amount,
            'saved_amount': goal.saved_amount,
            'deadline': goal.deadline
        } if goal else None,
        'savings_goals': [
            {'id': g.id, 'goal_name': g.goal_name, 'target_amount': g.target_amount,
             'saved_amount': g.saved_amount, 'deadline': g.deadline}
            for g in all_goals
        ],
    })

# ── EXPENSES ──────────────────────────────────────────────────────────────────

@app.route('/api/expenses', methods=['GET'])
@jwt_required()
def get_expenses():
    uid = int(get_jwt_identity())
    exps = Expense.query.filter_by(user_id=uid).order_by(Expense.date.desc()).all()
    return jsonify([
        {'id': e.id, 'amount': e.amount, 'category': e.category, 'date': e.date, 'note': e.note}
        for e in exps
    ])

@app.route('/api/expenses', methods=['POST'])
@jwt_required()
def add_expense():
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    data = request.get_json(silent=True) or {}
    require_fields(data, ['amount', 'category', 'date'])
    amount = parse_positive_amount(data['amount'])
    category = parse_category(data['category'])
    date = validate_transaction_date(data['date'], user)
    note = str(data.get('note', ''))[:300]

    e = Expense(user_id=uid, amount=amount, category=category, date=date, note=note)
    db.session.add(e)
    db.session.commit()

    limit_warning = None
    limit = CategoryLimit.query.filter_by(user_id=uid, category=category).first()
    if limit:
        month_str = datetime.now().strftime('%Y-%m')
        month_exp = Expense.query.filter_by(user_id=uid, category=category).all()
        month_total = sum(ex.amount for ex in month_exp if ex.date.startswith(month_str))
        percent = (month_total / limit.monthly_limit * 100) if limit.monthly_limit > 0 else 0
        if percent >= 100:
            limit_warning = {
                'type': 'exceeded',
                'category': category,
                'message': f"You have exceeded your ₵{limit.monthly_limit:.2f} limit for {category} this month."
            }
        elif percent >= 80:
            limit_warning = {
                'type': 'warning',
                'category': category,
                'message': f"You are at {percent:.0f}% of your {category} limit this month."
            }

    return jsonify({'id': e.id, 'message': 'Expense added', 'limit_warning': limit_warning}), 201

@app.route('/api/expenses/<int:eid>', methods=['DELETE'])
@jwt_required()
def delete_expense(eid):
    uid = int(get_jwt_identity())
    e = Expense.query.filter_by(id=eid, user_id=uid).first()
    if not e:
        return jsonify({'error': 'Not found'}), 404
    db.session.delete(e)
    db.session.commit()
    return jsonify({'message': 'Deleted'})

# ── SAVINGS ───────────────────────────────────────────────────────────────────

@app.route('/api/savings/goal', methods=['GET'])
@jwt_required()
def get_goal():
    uid = int(get_jwt_identity())
    goal = SavingsGoal.query.filter_by(user_id=uid).order_by(SavingsGoal.id.asc()).first()
    if not goal:
        return jsonify(None)
    deps = SavingsDeposit.query.filter_by(goal_id=goal.id).order_by(SavingsDeposit.date.desc()).all()

    total_deps = len(deps)
    remaining_amount = goal.target_amount - goal.saved_amount

    if total_deps > 0:
        earliest = min(d.date for d in deps)
        earliest_dt = datetime.strptime(earliest, '%Y-%m-%d')
        months_active = max(1, (datetime.now().year - earliest_dt.year) * 12 + (datetime.now().month - earliest_dt.month) + 1)
        avg_monthly = goal.saved_amount / months_active
    else:
        avg_monthly = 0

    if avg_monthly > 0 and remaining_amount > 0:
        months_needed = remaining_amount / avg_monthly
        completion_date = (datetime.now() + timedelta(days=30 * months_needed)).strftime('%B %Y')
        on_track = True
    elif goal.saved_amount >= goal.target_amount:
        months_needed = 0
        completion_date = 'Goal reached!'
        on_track = True
    else:
        months_needed = None
        completion_date = None
        on_track = False

    deadline_warning = None
    if goal.deadline and months_needed:
        deadline_dt = datetime.strptime(goal.deadline, '%Y-%m-%d')
        months_to_deadline = (deadline_dt.year - datetime.now().year) * 12 + (deadline_dt.month - datetime.now().month)
        if months_needed > months_to_deadline:
            needed_monthly = remaining_amount / max(1, months_to_deadline)
            deadline_warning = f"At your current rate you will miss your deadline. You need to save ₵{needed_monthly:.2f} per month to reach your goal by {goal.deadline}."

    return jsonify({
        'id': goal.id,
        'goal_name': goal.goal_name,
        'target_amount': goal.target_amount,
        'saved_amount': goal.saved_amount,
        'deadline': goal.deadline,
        'deposits': [{'id': d.id, 'amount': d.amount, 'date': d.date} for d in deps],
        'projection': {
            'avg_monthly_deposit': round(avg_monthly, 2),
            'months_needed': round(months_needed, 1) if months_needed else None,
            'completion_date': completion_date,
            'on_track': on_track,
            'deadline_warning': deadline_warning,
            'remaining_amount': round(remaining_amount, 2)
        }
    })

@app.route('/api/savings/goal', methods=['POST'])
@jwt_required()
def create_goal():
    uid = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    require_fields(data, ['goal_name', 'target_amount'])
    target_amount = parse_positive_amount(data['target_amount'], 'target_amount')
    deadline = data.get('deadline') or None
    if deadline:
        parse_date(deadline, 'deadline')

    existing = SavingsGoal.query.filter_by(user_id=uid).order_by(SavingsGoal.id.asc()).first()
    if existing:
        SavingsDeposit.query.filter_by(goal_id=existing.id).delete()
        db.session.delete(existing)

    goal = SavingsGoal(
        user_id=uid,
        goal_name=str(data['goal_name']).strip(),
        target_amount=target_amount,
        deadline=deadline or ''
    )
    db.session.add(goal)
    db.session.commit()
    return jsonify({'id': goal.id, 'message': 'Goal created'}), 201

@app.route('/api/savings/deposit', methods=['POST'])
@jwt_required()
def add_deposit():
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    data = request.get_json(silent=True) or {}
    require_fields(data, ['amount', 'date'])
    amount = parse_positive_amount(data['amount'])
    date = validate_transaction_date(data['date'], user)

    goal = SavingsGoal.query.filter_by(user_id=uid).order_by(SavingsGoal.id.asc()).first()
    if not goal:
        return jsonify({'error': 'No goal found'}), 404
    d = SavingsDeposit(goal_id=goal.id, amount=amount, date=date)
    goal.saved_amount = round(goal.saved_amount + amount, 2)
    db.session.add(d)
    db.session.commit()
    return jsonify({'message': 'Deposit logged'}), 201

# ── SAVINGS (MULTI-GOAL) ──────────────────────────────────────────────────────
# New endpoints supporting multiple concurrent goals per user. The legacy
# /api/savings/goal (GET/POST) and /api/savings/deposit routes above are left
# completely untouched for backward compatibility — they continue to operate
# on whatever goal .first() happens to return.

def _compute_goal_details(goal):
    """Builds the same projection/deposit-history payload as the legacy
    get_goal() route, kept as an independent function so that route is never
    touched. Any future divergence between single- and multi-goal projection
    logic should happen here, not there."""
    deps = SavingsDeposit.query.filter_by(goal_id=goal.id).order_by(SavingsDeposit.date.desc()).all()

    total_deps = len(deps)
    remaining_amount = goal.target_amount - goal.saved_amount

    if total_deps > 0:
        earliest = min(d.date for d in deps)
        earliest_dt = datetime.strptime(earliest, '%Y-%m-%d')
        months_active = max(1, (datetime.now().year - earliest_dt.year) * 12 + (datetime.now().month - earliest_dt.month) + 1)
        avg_monthly = goal.saved_amount / months_active
    else:
        avg_monthly = 0

    if avg_monthly > 0 and remaining_amount > 0:
        months_needed = remaining_amount / avg_monthly
        completion_date = (datetime.now() + timedelta(days=30 * months_needed)).strftime('%B %Y')
        on_track = True
    elif goal.saved_amount >= goal.target_amount:
        months_needed = 0
        completion_date = 'Goal reached!'
        on_track = True
    else:
        months_needed = None
        completion_date = None
        on_track = False

    deadline_warning = None
    if goal.deadline and months_needed:
        deadline_dt = datetime.strptime(goal.deadline, '%Y-%m-%d')
        months_to_deadline = (deadline_dt.year - datetime.now().year) * 12 + (deadline_dt.month - datetime.now().month)
        if months_needed > months_to_deadline:
            needed_monthly = remaining_amount / max(1, months_to_deadline)
            deadline_warning = f"At your current rate you will miss your deadline. You need to save ₵{needed_monthly:.2f} per month to reach your goal by {goal.deadline}."

    return {
        'id': goal.id,
        'goal_name': goal.goal_name,
        'target_amount': goal.target_amount,
        'saved_amount': goal.saved_amount,
        'deadline': goal.deadline,
        'created_at': goal.created_at.strftime('%Y-%m-%d') if goal.created_at else None,
        'deposits': [{'id': d.id, 'amount': d.amount, 'date': d.date} for d in deps],
        'projection': {
            'avg_monthly_deposit': round(avg_monthly, 2),
            'months_needed': round(months_needed, 1) if months_needed else None,
            'completion_date': completion_date,
            'on_track': on_track,
            'deadline_warning': deadline_warning,
            'remaining_amount': round(remaining_amount, 2)
        }
    }

@app.route('/api/savings/goals', methods=['GET'])
@jwt_required()
def get_goals():
    uid = int(get_jwt_identity())
    goals = SavingsGoal.query.filter_by(user_id=uid).order_by(SavingsGoal.created_at.asc()).all()
    return jsonify([_compute_goal_details(g) for g in goals])

@app.route('/api/savings/goals', methods=['POST'])
@jwt_required()
def create_goal_multi():
    uid = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    require_fields(data, ['goal_name', 'target_amount'])
    target_amount = parse_positive_amount(data['target_amount'], 'target_amount')
    deadline = data.get('deadline') or None
    if deadline:
        parse_date(deadline, 'deadline')

    goal_name = str(data['goal_name']).strip()[:100]
    if not goal_name:
        raise ValidationError('goal_name is required')

    goal = SavingsGoal(
        user_id=uid,
        goal_name=goal_name,
        target_amount=target_amount,
        deadline=deadline or ''
    )
    db.session.add(goal)
    db.session.commit()
    return jsonify(_compute_goal_details(goal)), 201

@app.route('/api/savings/goals/<int:gid>', methods=['DELETE'])
@jwt_required()
def delete_goal(gid):
    uid = int(get_jwt_identity())
    goal = SavingsGoal.query.filter_by(id=gid, user_id=uid).first()
    if not goal:
        return jsonify({'error': 'Not found'}), 404
    SavingsDeposit.query.filter_by(goal_id=goal.id).delete()
    db.session.delete(goal)
    db.session.commit()
    return jsonify({'message': 'Goal deleted'})

@app.route('/api/savings/goals/<int:gid>/deposit', methods=['POST'])
@jwt_required()
def deposit_to_goal(gid):
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    goal = SavingsGoal.query.filter_by(id=gid, user_id=uid).first()
    if not goal:
        return jsonify({'error': 'Not found'}), 404

    data = request.get_json(silent=True) or {}
    require_fields(data, ['amount', 'date'])
    amount = parse_positive_amount(data['amount'])
    date = validate_transaction_date(data['date'], user)

    d = SavingsDeposit(goal_id=goal.id, amount=amount, date=date)
    goal.saved_amount = round(goal.saved_amount + amount, 2)
    db.session.add(d)
    db.session.commit()
    return jsonify(_compute_goal_details(goal)), 201
# ── CATEGORY LIMITS ───────────────────────────────────────────────────────────

# How many past calendar months feed the historical trend (D) and suggested
# starting limit (E) features. Calendar-month based, not aligned to the
# user's actual allowance cycle — same known simplification as the savings
# bridge in get_limits below. A fully cycle-aligned version would need to
# walk backwards through get_next_payday's logic for each past cycle, which
# is a bigger rewrite than this pass covers.
HISTORY_LOOKBACK_MONTHS = 4
# Below this many tracked months, an "average" is just that one month's raw
# total — mathematically correct but reads as misleading rather than a real
# trend. Better to say "still gathering data" than show a number that looks
# like an average but isn't one yet.
MIN_MONTHS_FOR_HISTORY = 2

def _month_str_offset(base_date, months_back):
    """YYYY-MM string for `months_back` whole months before base_date."""
    total = base_date.month - 1 - months_back
    year = base_date.year + total // 12
    month = total % 12 + 1
    return f"{year:04d}-{month:02d}"

def get_active_past_months(all_exp, today, lookback=HISTORY_LOOKBACK_MONTHS):
    """Past calendar months (excluding the current, still-in-progress one)
    where the user logged at least one expense of ANY category. Used as the
    denominator for historical averages so a user who joined 3 weeks ago
    isn't diluted against months before they even used the app."""
    candidate_months = [_month_str_offset(today, i) for i in range(1, lookback + 1)]
    months_with_activity = {e.date[:7] for e in all_exp}
    return [m for m in candidate_months if m in months_with_activity]

# ── LOGS ──────────────────────────────────────────────────────────────────────
# Read-only union of expenses and savings deposits into one combined history,
# plus deletion that dispatches to the correct underlying table. Deliberately
# does not add a new database table: both source tables stay exactly as they
# are, which keeps this feature from being able to desync from Expenses or
# Savings.

def _user_goals(uid):
    """All of a user's savings goals, oldest first (stable order on every database)."""
    return (SavingsGoal.query.filter_by(user_id=uid)
            .order_by(SavingsGoal.created_at.asc(), SavingsGoal.id.asc()).all())


def _month_deposits_all_goals(goals, month_str):
    """Deposits made this month into ANY of the given goals."""
    ids = [g.id for g in goals]
    if not ids:
        return []
    deposits = SavingsDeposit.query.filter(SavingsDeposit.goal_id.in_(ids)).all()
    return [d for d in deposits if d.date.startswith(month_str)]


def _get_log_entries(uid):
    entries = []
    for e in Expense.query.filter_by(user_id=uid).all():
        entries.append({
            'id': e.id, 'type': 'expense', 'amount': e.amount,
            'category': e.category, 'date': e.date, 'note': e.note,
        })

    deposits = (db.session.query(SavingsDeposit, SavingsGoal)
                .join(SavingsGoal, SavingsDeposit.goal_id == SavingsGoal.id)
                .filter(SavingsGoal.user_id == uid).all())
    for d, goal in deposits:
        entries.append({
            'id': d.id, 'type': 'saving', 'amount': d.amount,
            'category': 'Savings', 'goal_name': goal.goal_name,
            'date': d.date, 'note': '',
        })

    entries.sort(key=lambda x: (x['date'], x['id']), reverse=True)
    return entries


def filter_logs(entries, args):
    entry_type = args.get('type')
    if entry_type in ('expense', 'saving'):
        entries = [e for e in entries if e['type'] == entry_type]

    category = args.get('category')
    if category:
        entries = [e for e in entries if e['category'] == category]

    start_date = args.get('start_date')
    if start_date:
        entries = [e for e in entries if e['date'] >= start_date]

    end_date = args.get('end_date')
    if end_date:
        entries = [e for e in entries if e['date'] <= end_date]

    search = args.get('search', '').strip().lower()
    if search:
        entries = [
            e for e in entries
            if search in (e.get('note') or '').lower()
            or search in (e.get('goal_name') or '').lower()
            or search in e['category'].lower()
        ]

    return entries


@app.route('/api/logs', methods=['GET'])
@jwt_required()
def get_logs():
    uid = int(get_jwt_identity())
    entries = _get_log_entries(uid)
    return jsonify(filter_logs(entries, request.args))


@app.route('/api/logs/summary', methods=['GET'])
@jwt_required()
def get_logs_summary():
    uid = int(get_jwt_identity())
    entries = filter_logs(_get_log_entries(uid), request.args)
    expense_entries = [e for e in entries if e['type'] == 'expense']
    saving_entries = [e for e in entries if e['type'] == 'saving']
    return jsonify({
        'total_expense_amount': round(sum(e['amount'] for e in expense_entries), 2),
        'total_savings_amount': round(sum(e['amount'] for e in saving_entries), 2),
        'expense_count': len(expense_entries),
        'savings_count': len(saving_entries),
        'total_count': len(entries),
    })


@app.route('/api/logs/<string:entry_type>/<int:entry_id>', methods=['DELETE'])
@jwt_required()
def delete_log_entry(entry_type, entry_id):
    uid = int(get_jwt_identity())

    if entry_type == 'expense':
        e = Expense.query.filter_by(id=entry_id, user_id=uid).first()
        if not e:
            return jsonify({'error': 'Not found'}), 404
        db.session.delete(e)
        db.session.commit()
        return jsonify({'message': 'Deleted'})

    if entry_type == 'saving':
        d = (SavingsDeposit.query
             .join(SavingsGoal, SavingsDeposit.goal_id == SavingsGoal.id)
             .filter(SavingsDeposit.id == entry_id, SavingsGoal.user_id == uid)
             .first())
        if not d:
            return jsonify({'error': 'Not found'}), 404
        goal = SavingsGoal.query.get(d.goal_id)
        # max(0, ...) guards against float rounding ever nudging this negative
        goal.saved_amount = max(0, round(goal.saved_amount - d.amount, 2))
        db.session.delete(d)
        db.session.commit()
        return jsonify({'message': 'Deleted'})

    raise ValidationError('type must be "expense" or "saving"')


@app.route('/api/limits', methods=['GET'])
@jwt_required()
def get_limits():
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    limits = CategoryLimit.query.filter_by(user_id=uid).all()
    today_dt = datetime.now()
    month_str = today_dt.strftime('%Y-%m')
    all_exp = Expense.query.filter_by(user_id=uid).all()
    month_exps = [e for e in all_exp if e.date.startswith(month_str)]

    active_past_months = get_active_past_months(all_exp, today_dt.date())

    # Per-category totals for each active past month — feeds both the
    # historical trend on existing limits (D) and suggested starting
    # limits for categories without one yet (E).
    past_month_cat_totals = {}
    for m in active_past_months:
        month_cat = {}
        for e in all_exp:
            if e.date.startswith(m):
                month_cat[e.category] = month_cat.get(e.category, 0) + e.amount
        past_month_cat_totals[m] = month_cat

    result = []
    limited_categories = set()
    for l in limits:
        limited_categories.add(l.category)
        spent = sum(e.amount for e in month_exps if e.category == l.category)
        percent = (spent / l.monthly_limit * 100) if l.monthly_limit > 0 else 0

        # (D) Historical memory: compares each active past month's spend for
        # this category against the CURRENT limit value. We don't store a
        # history of limit changes over time, so this assumes today's limit
        # applied throughout past months too — a known simplification, not
        # an oversight, flagged here for anyone extending this later.
        months_tracked = len(active_past_months)
        exceeded_count = 0
        history_total = 0
        for m in active_past_months:
            cat_spend = past_month_cat_totals[m].get(l.category, 0)
            history_total += cat_spend
            if l.monthly_limit > 0 and cat_spend > l.monthly_limit:
                exceeded_count += 1

        avg_monthly_spend = (
            round(history_total / months_tracked, 2)
             if months_tracked >= MIN_MONTHS_FOR_HISTORY else None
        )

        result.append({
            'id': l.id,
            'category': l.category,
            'monthly_limit': l.monthly_limit,
            'spent': round(spent, 2),
            'percent': round(percent, 1),
            'status': 'exceeded' if percent >= 100 else 'warning' if percent >= 80 else 'ok',
            'history': {
                'months_tracked': months_tracked,
                'avg_monthly_spend': avg_monthly_spend,
                'months_exceeded': exceeded_count
            }
        })

    # (E) Suggested starting limits: categories the user selected during
    # onboarding/settings but hasn't set a limit for yet, based on their OWN
    # average spend in that category over recent active months. Only
    # suggested when there's real data to base it on.
    user_categories = user.categories.split(',') if user.categories else []
    suggestions = []
    for cat in user_categories:
        cat = cat.strip()
        if not cat or cat in limited_categories:
            continue
        months_tracked = len(active_past_months)
        if months_tracked < MIN_MONTHS_FOR_HISTORY:
            continue
        total = sum(past_month_cat_totals[m].get(cat, 0) for m in active_past_months)
        avg = total / months_tracked
        if avg > 0:
            suggestions.append({
                'category': cat,
                'suggested_limit': round(avg, 2),
                'months_tracked': months_tracked
            })

    today = today_dt.date()
    next_payday = get_next_payday(user, today)
    if next_payday:
        days_left = max(1, (next_payday - today).days)
        cycle_id = next_payday.strftime('%Y-%m-%d')
    else:
        days_left = monthrange(today.year, today.month)[1] - today.day + 1
        cycle_id = f'cal-{month_str}'

    return jsonify({
        'limits': result,
        'suggestions': suggestions,
        'days_left': days_left,
        'cycle_id': cycle_id,
        'next_payday': next_payday.strftime('%Y-%m-%d') if next_payday else None
    })

@app.route('/api/limits', methods=['POST'])
@jwt_required()
def set_limit():
    uid = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    require_fields(data, ['category', 'monthly_limit'])
    category = parse_category(data['category'])
    monthly_limit = parse_positive_amount(data['monthly_limit'], 'monthly_limit')

    existing = CategoryLimit.query.filter_by(user_id=uid, category=category).first()
    if existing:
        existing.monthly_limit = monthly_limit
    else:
        limit = CategoryLimit(user_id=uid, category=category, monthly_limit=monthly_limit)
        db.session.add(limit)
    db.session.commit()
    return jsonify({'message': 'Limit saved'})

@app.route('/api/limits/<int:lid>', methods=['DELETE'])
@jwt_required()
def delete_limit(lid):
    uid = int(get_jwt_identity())
    limit = CategoryLimit.query.filter_by(id=lid, user_id=uid).first()
    if not limit:
        return jsonify({'error': 'Not found'}), 404
    db.session.delete(limit)
    db.session.commit()
    return jsonify({'message': 'Deleted'})

# ── NOTIFICATIONS ─────────────────────────────────────────────────────────────

POSITIVE_LIMITS_DAYS_LEFT_THRESHOLD = 10
POSITIVE_STREAK_THRESHOLD = 3
POSITIVE_HEALTH_SCORE_THRESHOLD = 85

@app.route('/api/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    user = User.query.get(int(get_jwt_identity()))
    notifications = []
    month_str = datetime.now().strftime('%Y-%m')
    monthly_budget = user.monthly_budget or user.allowance_amount

    all_exp = Expense.query.filter_by(user_id=user.id).all()
    month_exp = [e for e in all_exp if e.date.startswith(month_str)]
    total = sum(e.amount for e in month_exp)

    today = datetime.now()
    days_left = monthrange(today.year, today.month)[1] - today.day + 1
    daily_rate = total / today.day if today.day > 0 else 0
    remaining = monthly_budget - total
    days_until_broke = remaining / daily_rate if daily_rate > 0 else days_left
    percent_used = (total / monthly_budget * 100) if monthly_budget > 0 else 0

    if percent_used >= 100:
        notifications.append({'type': 'danger', 'route': '/dashboard', 'message': f'You have exceeded your monthly budget by ₵{(total - monthly_budget):.2f}. Avoid all non-essential spending.'})
    elif percent_used >= 80:
        notifications.append({'type': 'warning', 'route': '/dashboard', 'message': f'You have used {percent_used:.0f}% of your monthly budget with {days_left} days left.'})

    if daily_rate > 0 and days_until_broke < days_left and days_until_broke < 7:
        notifications.append({'type': 'danger', 'route': '/dashboard', 'message': f'At your current spending rate you will run out of money in {int(days_until_broke)} day(s). Reduce spending immediately.'})

    limits = CategoryLimit.query.filter_by(user_id=user.id).all()
    limit_statuses = []
    for l in limits:
        spent = sum(e.amount for e in month_exp if e.category == l.category)
        percent = (spent / l.monthly_limit * 100) if l.monthly_limit > 0 else 0
        status = 'exceeded' if percent >= 100 else 'warning' if percent >= 80 else 'ok'
        limit_statuses.append(status)
        if status == 'exceeded':
            notifications.append({'type': 'danger', 'route': '/limits', 'message': f'You have exceeded your {l.category} limit of ₵{l.monthly_limit:.2f} this month.'})
        elif status == 'warning':
            notifications.append({'type': 'warning', 'route': '/limits', 'message': f'You are at {percent:.0f}% of your {l.category} spending limit.'})

    goals = _user_goals(user.id)
    if goals:
        if not _month_deposits_all_goals(goals, month_str):
            if len(goals) == 1:
                msg = f'You have not made a savings deposit this month. Your goal is ₵{goals[0].target_amount:.2f}.'
            else:
                msg = f'You have not made a savings deposit this month toward any of your {len(goals)} goals.'
            notifications.append({'type': 'info', 'route': '/savings', 'message': msg})

    today_str = today.strftime('%Y-%m-%d')
    today_exp = [e for e in all_exp if e.date == today_str]
    if not today_exp:
        notifications.append({'type': 'info', 'route': '/expenses', 'message': "You haven't logged any expenses today. Did you spend anything?"})

    if limits and all(s == 'ok' for s in limit_statuses) and total > 0:
        next_payday = get_next_payday(user, today.date())
        cycle_days_left = (
            max(1, (next_payday - today.date()).days) if next_payday
            else monthrange(today.year, today.month)[1] - today.day + 1
        )
        if cycle_days_left <= POSITIVE_LIMITS_DAYS_LEFT_THRESHOLD:
            notifications.append({
                'type': 'success',
                'route': '/limits',
                'message': f"You're on track with all {len(limits)} of your spending limit{'s' if len(limits) != 1 else ''} this cycle. Keep it up!"
            })

    streak = calculate_streak(user)
    if streak >= POSITIVE_STREAK_THRESHOLD:
        notifications.append({
            'type': 'success',
            'route': '/dashboard',
            'message': f"You've stayed within your daily budget for {streak} days in a row. Great discipline!"
        })

    health = calculate_health_score(user)
    if health['score'] >= POSITIVE_HEALTH_SCORE_THRESHOLD and not health['new_account']:
        notifications.append({
            'type': 'success',
            'route': '/dashboard',
            'message': f"Your financial health score is excellent ({health['score']}/100). You're managing your money really well."
        })

    return jsonify(notifications)

# ── AI HELPERS ────────────────────────────────────────────────────────────────

def get_user_context(user):
    month_str = datetime.now().strftime('%Y-%m')
    exps = Expense.query.filter_by(user_id=user.id).all()
    month_exps = [e for e in exps if e.date.startswith(month_str)]
    total = sum(e.amount for e in month_exps)
    monthly_budget = user.monthly_budget or user.allowance_amount
    remaining = monthly_budget - total
    cats = {}
    for e in month_exps:
        cats[e.category] = cats.get(e.category, 0) + e.amount
    goal = SavingsGoal.query.filter_by(user_id=user.id).order_by(SavingsGoal.id.asc()).first()
    return total, remaining, cats, goal, monthly_budget

# A brand-new account has had no chance to save yet, so the savings-consistency
# rules in calculate_health_score only start applying after this many days.
# Set to 0 to apply them immediately (e.g. to demonstrate the "no savings
# deposit" penalty on a freshly created test account).
NEW_ACCOUNT_GRACE_DAYS = 3

def calculate_health_score(user):
    month_str = datetime.now().strftime('%Y-%m')
    last_month = (datetime.now().replace(day=1) - timedelta(days=1)).strftime('%Y-%m')

    all_exp = Expense.query.filter_by(user_id=user.id).all()
    month_exp = [e for e in all_exp if e.date.startswith(month_str)]
    last_month_exp = [e for e in all_exp if e.date.startswith(last_month)]

    total_this_month = sum(e.amount for e in month_exp)
    total_last_month = sum(e.amount for e in last_month_exp)
    monthly_budget = user.monthly_budget or user.allowance_amount
    goal = SavingsGoal.query.filter_by(user_id=user.id).order_by(SavingsGoal.id.asc()).first()

    score = 100
    reasons = []

    if monthly_budget > 0:
        percent_used = total_this_month / monthly_budget
        if percent_used > 1.0:
            score -= 50
            reasons.append(f"You have exceeded your monthly budget by ₵{(total_this_month - monthly_budget):.2f}")
        elif percent_used > 0.85:
            score -= 35
            reasons.append("You are close to exceeding your monthly budget")
        elif percent_used > 0.7:
            score -= 15
            reasons.append("You have used over 70% of your monthly budget")

    # New accounts get a short grace period before savings rules apply
    # (a missing created_at is treated as an established account).
    in_grace = bool(
        NEW_ACCOUNT_GRACE_DAYS > 0
        and user.created_at
        and (datetime.utcnow() - user.created_at).days < NEW_ACCOUNT_GRACE_DAYS
    )

    # Savings consistency (30 points): no deposit this month costs 30; a goal
    # that is less than 10% funded costs 15. Having no goal means no deposits.
    if not in_grace:
        goals = _user_goals(user.id)
        if not goals:
            score -= 30
            reasons.append("You have not set a savings goal yet")
        else:
            total_saved = sum(g.saved_amount for g in goals)
            total_target = sum(g.target_amount for g in goals)
            if not _month_deposits_all_goals(goals, month_str):
                score -= 30
                reasons.append("You have not made any savings deposits this month")
            elif total_saved < total_target * 0.1:
                score -= 15
                reasons.append("Your savings progress is very low compared to your target")

    if month_exp:
        cats = {}
        for e in month_exp:
            cats[e.category] = cats.get(e.category, 0) + e.amount
        if total_this_month > 0:
            highest = max(cats.values())
            if highest / total_this_month > 0.6:
                top_cat = max(cats, key=cats.get)
                score -= 20
                reasons.append(f"Over 60% of your spending is going to {top_cat}")

    if total_last_month > 0 and total_this_month > total_last_month * 1.2:
        score -= 10
        reasons.append("You are spending significantly more than last month")

    score = max(0, score)

    if score >= 70:
        status, emoji, label = 'good', '🟢', 'Healthy'
    elif score >= 40:
        status, emoji, label = 'warning', '🟡', 'Needs Attention'
    else:
        status, emoji, label = 'critical', '🔴', 'Critical'

    if reasons:
        top_reason = reasons[0]
    elif in_grace:
        top_reason = "Welcome! Log your expenses and make your first savings deposit to build your score."
    else:
        top_reason = "Keep up the good work and stay consistent!"

    return {
        'score': score,
        'status': status,
        'emoji': emoji,
        'label': label,
        'reason': top_reason,
        'new_account': in_grace
    }

@app.route('/api/health-score', methods=['GET'])
@jwt_required()
def get_health_score():
    user = User.query.get(int(get_jwt_identity()))
    return jsonify(calculate_health_score(user))

# ── AI ROUTES ─────────────────────────────────────────────────────────────────
@app.route('/api/ai/tip', methods=['POST'])
@jwt_required()
def ai_tip():
    user = User.query.get(int(get_jwt_identity()))

    month_str = datetime.now().strftime('%Y-%m')
    all_exp = Expense.query.filter_by(user_id=user.id).all()
    month_exps = [e for e in all_exp if e.date.startswith(month_str)]
    total = sum(e.amount for e in month_exps)
    monthly_budget = user.monthly_budget or user.allowance_amount
    remaining = monthly_budget - total
    cats = {}
    for e in month_exps:
        cats[e.category] = cats.get(e.category, 0) + e.amount

    today = datetime.now()
    next_payday = get_next_payday(user, today.date())
    if next_payday:
        days_left = max(1, (next_payday - today.date()).days)
        cycle_length = get_cycle_length_days(user, next_payday)
    else:
        days_in_month = monthrange(today.year, today.month)[1]
        days_left = days_in_month - today.day + 1
        cycle_length = days_in_month
    daily_budget = remaining / days_left if days_left > 0 else 0
    normal_daily_rate = monthly_budget / cycle_length if cycle_length > 0 else 0
    # Same days-left-aware survival check as the dashboard, so the AI tip
    # and the survival-mode banner never disagree with each other.
    survival_mode = monthly_budget > 0 and daily_budget < normal_daily_rate * 0.5

    tip = f"You've spent ₵{total:.2f} this month with ₵{remaining:.2f} remaining for {days_left} more days (about ₵{daily_budget:.2f}/day). {'You are running low — focus on essentials only.' if survival_mode else 'You are on track. Keep logging your expenses to stay aware.'}"

    try:
        urgency_rule = (
            "The student is in survival mode: their remaining money is tight relative to days left. "
            "Lead with a clear, honest warning about this — do not say anything resembling 'great job' or "
            "'you're doing well' or similar praise, even if they are technically under their total budget. "
            "Being encouraging must never override being honest about risk."
            if survival_mode else
            "The student currently has a reasonable daily budget for the days remaining. You can be encouraging, "
            "but still mention the daily amount they have left so they stay aware, rather than implying they can relax."
        )
        prompt = (
            f"You are a friendly financial advisor for a Ghanaian university student. "
            f"Monthly budget: GHS {monthly_budget}. Spent this month: GHS {total}. Remaining: GHS {remaining}. "
            f"Days left until next allowance: {days_left}. That is about GHS {daily_budget:.2f} per day remaining. "
            f"Spending by category: {cats}. {urgency_rule} "
            f"Give ONE short actionable tip (2-3 sentences) that reflects the real urgency of their situation. Use GHS. "
            f"Respond in plain conversational text only — no markdown, no asterisks, no bullet points, no bold or italics, no headers."
        )
        tip = call_groq([{"role": "user", "content": prompt}], max_tokens=600)
    except Exception as e:
        print(f"AI TIP ERROR: {e}")

    return jsonify({'tip': tip})

@app.route('/api/ai/chat', methods=['POST'])
@jwt_required()
def ai_chat():
    user = User.query.get(int(get_jwt_identity()))
    data = request.get_json(silent=True) or {}
    require_fields(data, ['message'])
    user_message = str(data['message']).strip()[:2000]
    history = sanitize_history(data.get('history'))

    month_str = datetime.now().strftime('%Y-%m')
    all_exp = Expense.query.filter_by(user_id=user.id).all()
    month_exps = [e for e in all_exp if e.date.startswith(month_str)]
    total = sum(e.amount for e in month_exps)
    monthly_budget = user.monthly_budget or user.allowance_amount
    remaining = monthly_budget - total
    cats = {}
    for e in month_exps:
        cats[e.category] = cats.get(e.category, 0) + e.amount
    goals = _user_goals(user.id)
    goal_info = "; ".join(
        f"Savings goal: {g.goal_name}, Target: GHS {g.target_amount}, Saved: GHS {g.saved_amount}" for g in goals
    ) if goals else "No savings goal set."

    reply = f"You've spent ₵{total:.2f} this month with ₵{remaining:.2f} left. Focus on essential spending like feeding and transport to make it through the month comfortably."

    try:
        system_prompt = f"You are FinWise AI, a friendly financial advisor for a Ghanaian university student. Monthly budget: GHS {monthly_budget}. Spent: GHS {total}. Remaining: GHS {remaining}. Spending by category: {cats}. {goal_info}. Keep responses to 3-4 sentences, unless the user asks for a breakdown or a list of steps — then use short markdown bullet points. Use GHS. Be practical and encouraging. This is general guidance, not licensed financial advice. The chat UI renders markdown properly, so use **bold** for key figures or actions, and bullet/numbered lists when giving multiple recommendations. Don't overuse formatting — most replies should still read as natural conversation."
        messages = [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": user_message}]
        reply = call_groq(messages, max_tokens=800)
    except Exception as e:
        print(f"AI CHAT ERROR: {e}")

    return jsonify({'reply': reply})

# ── RUN ───────────────────────────────────────────────────────────────────────

# Runs under both `python app.py` and gunicorn (previously only the former).
with app.app_context():
    db.create_all()
    print("✅ FinWise database ready")

if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_DEBUG') == '1'
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5000)), debug=debug_mode)