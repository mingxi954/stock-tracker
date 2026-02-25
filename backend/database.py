import sqlite3
from datetime import datetime
from contextlib import contextmanager

DATABASE = 'stocks.db'

@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    """Initialize the database with required tables."""
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS tracked_stocks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                date_noticed TEXT NOT NULL,
                price_noticed REAL NOT NULL,
                notes TEXT,
                created_at TEXT NOT NULL
            )
        ''')
        conn.commit()

def add_stock(symbol, date_noticed, price_noticed, notes=''):
    """Add a new stock to track."""
    with get_db() as conn:
        cursor = conn.execute(
            'INSERT INTO tracked_stocks (symbol, date_noticed, price_noticed, notes, created_at) VALUES (?, ?, ?, ?, ?)',
            (symbol.upper(), date_noticed, price_noticed, notes, datetime.now().isoformat())
        )
        return cursor.lastrowid

def get_all_stocks():
    """Get all tracked stocks."""
    with get_db() as conn:
        cursor = conn.execute(
            'SELECT * FROM tracked_stocks ORDER BY created_at DESC'
        )
        return [dict(row) for row in cursor.fetchall()]

def delete_stock(stock_id):
    """Delete a tracked stock."""
    with get_db() as conn:
        conn.execute('DELETE FROM tracked_stocks WHERE id = ?', (stock_id,))
        return conn.total_changes > 0

def delete_stocks_by_symbol(symbol):
    """Delete all entries for a symbol."""
    with get_db() as conn:
        conn.execute('DELETE FROM tracked_stocks WHERE symbol = ?', (symbol.upper(),))
        return conn.total_changes > 0

def get_stock(stock_id):
    """Get a specific stock by ID."""
    with get_db() as conn:
        cursor = conn.execute('SELECT * FROM tracked_stocks WHERE id = ?', (stock_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
