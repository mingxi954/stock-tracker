# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Application

```bash
# Install dependencies
pip install -r requirements.txt

# Run the Flask development server
python backend/app.py

# Access at http://localhost:5000
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

1. **Current prices** (`get_current_price`): Uses `yf.Ticker(symbol).history(period='1d')` to get the latest close price

2. **Historical prices** (`get_historical_prices`): Fetches prices from specific time periods
   - Maps periods ('1d', '1wk', '1mo', '3mo') to day ranges (2, 7, 31, 92 days)
   - Returns the **oldest** close price in each period (via `iloc[0]`)
   - This approach shows what the price was N days/weeks/months ago

### API Endpoints

- `GET /` - Serves the main HTML page
- `GET /api/stocks` - Returns all tracked stocks with enriched price data (current + historical + calculated changes)
- `POST /api/stocks` - Add new stock (requires: symbol, date_noticed, price_noticed, optional notes)
- `DELETE /api/stocks/<id>` - Delete a tracked stock
- `GET /api/price/<symbol>` - Get current price for a symbol (used by "Fetch Current Price" button)

### Data Flow

1. User adds stock via form → POST to `/api/stocks` → stored in SQLite
2. Frontend loads stocks → GET `/api/stocks` → backend enriches each stock with:
   - Current price from yfinance
   - Historical prices (1d, 1wk, 1mo, 3mo ago)
   - Calculated change ($ and %) since date_noticed
3. All stock data fetching happens server-side; frontend receives enriched JSON

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
- **Port**: Runs on port 5000 by default
- **Debug mode**: Enabled by default (`app.run(debug=True)`)
- **CORS**: Enabled via flask-cors for potential frontend development

## Modifying the Application

When adding new features:

- New database operations → add functions to `database.py` using the `get_db()` context manager
- New API endpoints → add routes to `backend/app.py`
- New UI features → modify `frontend/templates/index.html` and `frontend/static/app.js`
- Frontend communicates via fetch API to `/api/*` endpoints expecting JSON responses
