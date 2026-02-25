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

def get_historical_prices(symbol, periods=['1d', '1wk', '1mo', '3mo']):
    """Fetch historical prices for the given symbol."""
    try:
        stock = yf.Ticker(symbol)
        prices = {}

        period_map = {
            '1d': 2,    # Get 2 days to ensure we have data
            '1wk': 7,   # Get 7 days
            '1mo': 31,  # Get ~1 month
            '3mo': 92   # Get ~3 months
        }

        for period in periods:
            days = period_map.get(period, 2)
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)

            hist = stock.history(start=start_date, end=end_date)

            if not hist.empty:
                # Get the oldest available close price in the period
                prices[period] = {
                    'price': round(hist['Close'].iloc[0], 2),
                    'date': hist.index[0].strftime('%Y-%m-%d')
                }
            else:
                prices[period] = None

        return prices
    except Exception as e:
        print(f"Error fetching historical prices for {symbol}: {e}")
        return {period: None for period in periods}

def get_current_price(symbol):
    """Fetch current price for the given symbol."""
    try:
        stock = yf.Ticker(symbol)
        data = stock.history(period='1d')
        if not data.empty:
            return round(data['Close'].iloc[-1], 2)
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
    """Get all tracked stocks with current and historical prices."""
    stocks = database.get_all_stocks()

    for stock in stocks:
        symbol = stock['symbol']

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
    return jsonify({'error': 'Could not fetch price'}), 404

if __name__ == '__main__':
    app.run(debug=True, port=5000)
