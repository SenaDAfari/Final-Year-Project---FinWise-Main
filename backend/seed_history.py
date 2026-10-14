# Run from the folder that contains app.py, using the same environment (.env) as the app.
# It adds backdated expenses for ONE test account so the Limits page can show its
# historical trend and suggested starting limit. Use a test account only.
from datetime import date
from app import app, db, User, Expense, CategoryLimit

EMAIL = 'test1@gmail.com'   # <-- change this

def month_day(months_back, day=15):
    y, m = date.today().year, date.today().month - months_back
    while m <= 0:
        m += 12; y -= 1
    return date(y, m, day).strftime('%Y-%m-%d')

with app.app_context():
    u = User.query.filter_by(email=EMAIL).first()
    assert u, 'user not found'
    limited = {l.category for l in CategoryLimit.query.filter_by(user_id=u.id)}
    cats = [c.strip() for c in (u.categories or '').split(',') if c.strip()]
    free = [c for c in cats if c not in limited]            # categories without a limit (gets a suggestion)
    plan = []
    for back in (1, 2, 3):
        for l in CategoryLimit.query.filter_by(user_id=u.id):
            # last month goes over the limit, earlier months stay under it
            amt = l.monthly_limit * (1.1 if back == 1 else 0.6)
            plan.append((back, l.category, round(amt, 2)))
        for c in free[:1]:
            plan.append((back, c, 300.0 + 50 * back))
    for back, cat, amt in plan:
        db.session.add(Expense(user_id=u.id, amount=amt, category=cat,
                               date=month_day(back), note='seeded for testing'))
    db.session.commit()
    print('added', len(plan), 'expenses')