# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Application

```bash
# Install dependencies
pip install -r requirements.txt

# Run the Flask development server
python backend/app.py

# Access at http://localhost:5001
```

## Architecture Overview

This is a Flask-based web application with a REST API backend and vanilla JavaScript frontend for tracking stock prices over time.

### Backend Structure

- **backend/app.py**: Flask application and API endpoints
  - Serves both the web UI and REST API
  - Templates from `../frontend/templates`, static from `../frontend/static`
  - Integrates with yfinance to fetch stock data from Yahoo Finance
  - Database initialized on startup via `database.init_db()`

- **backend/database.py**: SQLite database layer
  - Uses context manager pattern (`get_db()`) for connection handling
  - Single table: `tracked_stocks` with fields: id, symbol, date_noticed, price_noticed, notes, created_at
  - All database functions handle their own connections and transactions

### Frontend Structure

- **frontend/templates/index.html**: Main single-page application
- **frontend/static/app.js**: Frontend logic (fetch API calls, DOM manipulation)
- **frontend/static/style.css**: Styling with gradient background and card-based layout

### Stock Price Fetching

The application fetches stock data in two ways:

1. **Current prices** (`get_current_price`): Uses `yf.Ticker(symbol).fast_info` with fallbacks to get the latest price

2. **Daily history** (`get_daily_history`): Fetches daily close prices for chart rendering
   - Supports periods: 1mo, 3mo, 6mo, 1yr
   - Returns array of `{date, price}` objects

### API Endpoints

- `GET /` - Serves the main HTML page
- `GET /api/stocks` - Returns stocks grouped by symbol, each with entries[] (date_noticed, price_noticed, change info) and current_price
- `POST /api/stocks` - Add new stock (requires: symbol, date_noticed, price_noticed, optional notes)
- `DELETE /api/stocks/<id>` - Delete a tracked stock entry
- `GET /api/price/<symbol>` - Get current price for a symbol (used by "Fetch Current Price" button)
- `GET /api/history/<symbol>?period=3mo` - Get daily price history for charts (periods: 1mo, 3mo, 6mo, 1yr)

### Data Flow

1. User adds stock via form → POST to `/api/stocks` → stored in SQLite
2. Frontend loads stocks → GET `/api/stocks` → backend groups entries by symbol, enriches with current price and per-entry change calculations
3. Frontend renders one card per symbol with a Chart.js line chart and a list of noticed entries
4. Charts load lazily via `/api/history/<symbol>` after cards render

## Database Schema

```sql
CREATE TABLE tracked_stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,           -- Stock ticker (e.g., "AAPL")
    date_noticed TEXT NOT NULL,     -- ISO date string
    price_noticed REAL NOT NULL,    -- Price when user noticed the stock
    notes TEXT,                     -- Optional user notes
    created_at TEXT NOT NULL        -- ISO timestamp of record creation
)
```

Database file: `stocks.db` (created automatically in project root)

## Key Technical Details

- **No tests**: This is a simple prototype without a test suite
- **No authentication**: Single-user local application
- **External dependency**: Requires internet connection for yfinance API
- **Port**: Runs on port 5001 by default, bound to 0.0.0.0 (all interfaces)
- **Debug mode**: Enabled by default (`app.run(debug=True)`)
- **CORS**: Enabled via flask-cors for potential frontend development

## Modifying the Application

When adding new features:

- New database operations → add functions to `database.py` using the `get_db()` context manager
- New API endpoints → add routes to `backend/app.py`
- New UI features → modify `frontend/templates/index.html` and `frontend/static/app.js`
- Frontend communicates via fetch API to `/api/*` endpoints expecting JSON responses
