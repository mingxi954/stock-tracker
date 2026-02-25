# Stock Tracker

A web-based application to track stocks you notice, monitor their prices, and view historical performance.

## Features

- **Track Stocks**: Add stocks with the date and price when you noticed them
- **Current Prices**: Automatically fetch current stock prices
- **Historical Prices**: View prices from 1 day, 1 week, 1 month, and 3 months ago
- **Performance Tracking**: See how much each stock has changed since you noticed it
- **Notes**: Add notes about why you noticed a stock
- **Clean UI**: Modern, responsive web interface

## Setup

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

### Installation

1. Navigate to the project directory:
```bash
cd stock-tracker
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running the Application

1. Start the Flask server:
```bash
python backend/app.py
```

2. Open your browser and go to:
```
http://localhost:5000
```

## Usage

### Adding a Stock

1. Enter the stock symbol (e.g., AAPL, TSLA, GOOGL)
2. Select the date you noticed it
3. Enter the price when you noticed it (or click "Fetch Current Price" to get today's price)
4. Optionally add notes about why you noticed this stock
5. Click "Add Stock"

### Viewing Stock Performance

The main page displays all your tracked stocks with:
- Current price
- Price when you noticed it
- Change in dollars and percentage
- Historical prices (1 day, 1 week, 1 month, 3 months ago)
- Your notes

### Refreshing Prices

Click the "🔄 Refresh Prices" button to update all stock prices with the latest data.

### Deleting a Stock

Click the "Delete" button on any stock card to remove it from your tracking list.

## Technology Stack

- **Backend**: Flask (Python)
- **Database**: SQLite
- **Stock Data**: yfinance (Yahoo Finance API)
- **Frontend**: HTML, CSS, JavaScript

## Data Storage

All stock data is stored in a local SQLite database file (`stocks.db`) in the project directory.

## Notes

- Stock prices are fetched from Yahoo Finance using the yfinance library
- Historical prices show the closing price from the specified time period ago
- The application works with most US and international stock symbols
- Internet connection required to fetch current prices

## Troubleshooting

**Stock prices not loading:**
- Check your internet connection
- Verify the stock symbol is correct
- Some stocks may have limited historical data

**Application won't start:**
- Make sure all dependencies are installed: `pip install -r requirements.txt`
- Check that port 5000 is not in use by another application

## Future Enhancements

Possible features to add:
- Charts and graphs for price history
- Email alerts for price changes
- Portfolio value tracking
- Export data to CSV
- Dark mode
- Multiple portfolios
