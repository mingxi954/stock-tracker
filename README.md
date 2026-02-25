# Hindsight

You know the feeling. You see a stock, something catches your eye — maybe it's in the news, maybe a friend mentioned it, maybe the chart just looks interesting. You think about buying but you don't pull the trigger. A week goes by. A month. Three months. And then you're left wondering: *what was the price when I first noticed it? How much would I be up right now?*

<p align="center">
  <img src="assets/screenshot.png" alt="Hindsight UI" width="700" />
</p>

**Hindsight** turns that regret into a system. Log the stocks you notice with the date and price, and watch what happens. Over time, you start seeing patterns — which instincts were right, which ones weren't, and why. No portfolio to manage, no money on the line — just a feedback loop that makes your next call sharper.

## What It Does

- **Log what you notice** — ticker, date, price, and a note about why it caught your eye
- **See what happened** — current price and change since you noticed it (in $ and %)
- **Interactive charts** — price history with 1M / 3M / 6M / 1Y toggle
- **Auto-fetch prices** — hit "Fetch Current Price" to fill in today's price when logging

## Quick Start

```bash
cd stock-tracker
pip install -r requirements.txt
python backend/app.py
```

Open http://localhost:5001 in your browser.

## Tech Stack

Flask + SQLite + vanilla JS. Stock data from Yahoo Finance via [yfinance](https://github.com/ranaroussi/yfinance). No API keys needed.
