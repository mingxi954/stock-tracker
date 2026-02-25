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

@app.route('/')
def index():
    """Serve the main page."""
    return render_template('index.html')

@app.route('/api/stocks', methods=['GET'])
def get_stocks():
    """Get all tracked stocks grouped by symbol with current prices."""
    stocks = database.get_all_stocks()

    # Group entries by symbol
    grouped = {}
    for stock in stocks:
        symbol = stock['symbol']
        if symbol not in grouped:
            grouped[symbol] = {
                'symbol': symbol,
                'entries': [],
                'current_price': None,
            }
        grouped[symbol]['entries'].append({
            'id': stock['id'],
            'date_noticed': stock['date_noticed'],
            'price_noticed': stock['price_noticed'],
            'notes': stock['notes'],
        })

    result = []
    for symbol, group in grouped.items():
        try:
            current_price = get_current_price(symbol)
            group['current_price'] = current_price

            # Calculate change for each entry
            for entry in group['entries']:
                if current_price and entry['price_noticed']:
                    change = current_price - entry['price_noticed']
                    change_percent = (change / entry['price_noticed']) * 100
                    entry['change'] = round(change, 2)
                    entry['change_percent'] = round(change_percent, 2)
        except Exception as e:
            print(f"Error enriching stock {symbol}: {e}")

        result.append(group)

    return jsonify(result)

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

def get_daily_history(symbol, period='3mo'):
    """Fetch daily close prices for the given symbol and period."""
    period_days = {
        '1mo': 31,
        '3mo': 92,
        '6mo': 183,
        '1yr': 365,
    }
    days = period_days.get(period, 92)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)

    try:
        stock = yf.Ticker(symbol)
        hist = stock.history(start=start_date, end=end_date)
        if hist.empty:
            return []
        data = []
        for idx, row in hist.iterrows():
            data.append({
                'date': idx.strftime('%Y-%m-%d'),
                'price': round(float(row['Close']), 2)
            })
        return data
    except Exception as e:
        print(f"Error fetching daily history for {symbol}: {e}")
        return []

@app.route('/api/history/<symbol>', methods=['GET'])
def get_history(symbol):
    """Get daily price history for a symbol."""
    period = request.args.get('period', '3mo')
    if period not in ('1mo', '3mo', '6mo', '1yr'):
        period = '3mo'
    symbol = symbol.upper()
    data = get_daily_history(symbol, period)
    return jsonify({'symbol': symbol, 'period': period, 'data': data})

@app.route('/api/price/<symbol>', methods=['GET'])
def get_price(symbol):
    """Get current price for a symbol."""
    current_price = get_current_price(symbol.upper())
    if current_price:
        return jsonify({'symbol': symbol.upper(), 'price': current_price})
    return jsonify({'error': 'Could not fetch price. Check the symbol and try again.'}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5001)
