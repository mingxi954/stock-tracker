from flask import Flask, jsonify, request, render_template, send_from_directory
from flask_cors import CORS
import yfinance as yf
from datetime import datetime, timedelta
from dateutil import parser
import database

app = Flask(__name__,
            template_folder='../frontend/templates',
            static_folder='../frontend/static')
CORS(app)

# Initialize database
database.init_db()

def get_current_price(symbol):
    """Fetch current price for the given symbol."""
    try:
        stock = yf.Ticker(symbol)

        # Try fast_info first (most reliable, fastest)
        try:
            price = stock.fast_info.get('lastPrice')
            if price and price > 0:
                return round(float(price), 2)
        except Exception:
            pass

        # Fallback to info dict
        try:
            info = stock.info
            for key in ['currentPrice', 'regularMarketPrice', 'previousClose']:
                price = info.get(key)
                if price and price > 0:
                    return round(float(price), 2)
        except Exception:
            pass

        # Last resort: history
        data = stock.history(period='5d')
        if not data.empty:
            return round(float(data['Close'].iloc[-1]), 2)

        return None
    except Exception as e:
        print(f"Error fetching current price for {symbol}: {e}")
        return None

def get_historical_prices(symbol):
    """Fetch historical prices for the given symbol."""
    try:
        stock = yf.Ticker(symbol)
        prices = {}

        period_configs = [
            ('1d', 5),
            ('1wk', 10),
            ('1mo', 35),
            ('3mo', 95),
        ]

        # Fetch 3 months of data in one call to avoid repeated API hits
        end_date = datetime.now()
        start_date = end_date - timedelta(days=95)
        hist = stock.history(start=start_date, end=end_date)

        if hist.empty:
            return {key: None for key, _ in period_configs}

        for period_key, target_days in period_configs:
            target_date = end_date - timedelta(days=target_days)
            # Find the closest available date
            available = hist[hist.index <= target_date.strftime('%Y-%m-%d %H:%M:%S%z') if hist.index.tz else target_date]
            if available.empty:
                # If no data before target, use earliest available
                available = hist.head(1)

            if not available.empty:
                row = available.iloc[-1]
                prices[period_key] = {
                    'price': round(float(row['Close']), 2),
                    'date': available.index[-1].strftime('%Y-%m-%d')
                }
            else:
                prices[period_key] = None

        return prices
    except Exception as e:
        print(f"Error fetching historical prices for {symbol}: {e}")
        return {'1d': None, '1wk': None, '1mo': None, '3mo': None}

@app.route('/')
def index():
    """Serve the main page."""
    return render_template('index.html')

@app.route('/api/stocks', methods=['GET'])
def get_stocks():
    """Get all tracked stocks with current and historical prices."""
    stocks = database.get_all_stocks()

    for stock in stocks:
        symbol = stock['symbol']

        try:
            # Get current price
            current_price = get_current_price(symbol)
            stock['current_price'] = current_price

            # Get historical prices
            historical = get_historical_prices(symbol)
            stock['price_1d'] = historical.get('1d')
            stock['price_1wk'] = historical.get('1wk')
            stock['price_1mo'] = historical.get('1mo')
            stock['price_3mo'] = historical.get('3mo')

            # Calculate change since noticed
            if current_price and stock['price_noticed']:
                change = current_price - stock['price_noticed']
                change_percent = (change / stock['price_noticed']) * 100
                stock['change'] = round(change, 2)
                stock['change_percent'] = round(change_percent, 2)
        except Exception as e:
            print(f"Error enriching stock {symbol}: {e}")
            stock['current_price'] = None
            stock['price_1d'] = None
            stock['price_1wk'] = None
            stock['price_1mo'] = None
            stock['price_3mo'] = None

    return jsonify(stocks)

@app.route('/api/stocks', methods=['POST'])
def add_stock():
    """Add a new stock to track."""
    data = request.json

    symbol = data.get('symbol', '').upper()
    date_noticed = data.get('date_noticed')
    price_noticed = data.get('price_noticed')
    notes = data.get('notes', '')

    if not symbol or not date_noticed or price_noticed is None:
        return jsonify({'error': 'Missing required fields'}), 400

    try:
        # Validate date format
        parser.parse(date_noticed)
        price_noticed = float(price_noticed)

        stock_id = database.add_stock(symbol, date_noticed, price_noticed, notes)
        return jsonify({'id': stock_id, 'message': 'Stock added successfully'}), 201
    except ValueError as e:
        return jsonify({'error': f'Invalid data: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stocks/<int:stock_id>', methods=['DELETE'])
def delete_stock(stock_id):
    """Delete a tracked stock."""
    if database.delete_stock(stock_id):
        return jsonify({'message': 'Stock deleted successfully'}), 200
    return jsonify({'error': 'Stock not found'}), 404

@app.route('/api/price/<symbol>', methods=['GET'])
def get_price(symbol):
    """Get current price for a symbol."""
    current_price = get_current_price(symbol.upper())
    if current_price:
        return jsonify({'symbol': symbol.upper(), 'price': current_price})
    return jsonify({'error': 'Could not fetch price. Check the symbol and try again.'}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5001)
