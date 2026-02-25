const API_BASE = '';

// Set today's date as default
document.getElementById('dateNoticed').valueAsDate = new Date();

// Load stocks on page load
document.addEventListener('DOMContentLoaded', () => {
    loadStocks();
});

// Add stock form submission
document.getElementById('addStockForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const symbol = document.getElementById('symbol').value.toUpperCase();
    const dateNoticed = document.getElementById('dateNoticed').value;
    const priceNoticed = parseFloat(document.getElementById('priceNoticed').value);
    const notes = document.getElementById('notes').value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    try {
        const response = await fetch(`${API_BASE}/api/stocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                symbol,
                date_noticed: dateNoticed,
                price_noticed: priceNoticed,
                notes
            })
        });

        if (response.ok) {
            document.getElementById('addStockForm').reset();
            document.getElementById('dateNoticed').valueAsDate = new Date();
            loadStocks();
            showToast(`${symbol} added successfully`, 'success');
        } else {
            const error = await response.json();
            showToast(error.error || 'Failed to add stock', 'error');
        }
    } catch (error) {
        showToast(`Network error: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Stock';
    }
});

// Fetch current price button
document.getElementById('fetchPriceBtn').addEventListener('click', async () => {
    const symbol = document.getElementById('symbol').value.trim().toUpperCase();

    if (!symbol) {
        showToast('Enter a stock symbol first', 'error');
        return;
    }

    const btn = document.getElementById('fetchPriceBtn');
    btn.disabled = true;
    btn.textContent = 'Fetching...';

    try {
        const response = await fetch(`${API_BASE}/api/price/${symbol}`);

        if (response.ok) {
            const data = await response.json();
            document.getElementById('priceNoticed').value = data.price;
            showToast(`${symbol}: $${data.price}`, 'success');
        } else {
            showToast(`Could not fetch price for ${symbol}`, 'error');
        }
    } catch (error) {
        showToast(`Network error: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Fetch Current Price';
    }
});

// Refresh button
document.getElementById('refreshBtn').addEventListener('click', () => {
    const btn = document.getElementById('refreshBtn');
    btn.disabled = true;
    btn.textContent = 'Refreshing...';
    loadStocks().finally(() => {
        btn.disabled = false;
        btn.textContent = 'Refresh Prices';
    });
});

// Load all stocks
async function loadStocks() {
    const container = document.getElementById('stocksContainer');
    const loading = document.getElementById('loadingMessage');

    loading.style.display = 'block';
    container.innerHTML = '';

    try {
        const response = await fetch(`${API_BASE}/api/stocks`);
        const stocks = await response.json();

        loading.style.display = 'none';

        if (stocks.length === 0) {
            container.innerHTML = '<p class="loading">No stocks tracked yet. Add one above.</p>';
            return;
        }

        stocks.forEach(stock => {
            container.appendChild(createStockCard(stock));
        });
    } catch (error) {
        loading.style.display = 'none';
        container.innerHTML = `<p class="loading">Error loading stocks: ${error.message}</p>`;
    }
}

// Create a stock card element
function createStockCard(stock) {
    const card = document.createElement('div');
    card.className = 'stock-card';

    const changeClass = stock.change >= 0 ? 'price-positive' : 'price-negative';
    const changeBadgeClass = stock.change >= 0 ? 'change-positive' : 'change-negative';
    const changeSign = stock.change >= 0 ? '+' : '';

    card.innerHTML = `
        <div class="stock-header">
            <div class="stock-symbol">${stock.symbol}</div>
            <div>
                ${stock.change !== undefined ? `
                    <span class="change-badge ${changeBadgeClass}">
                        ${changeSign}$${stock.change} (${changeSign}${stock.change_percent}%)
                    </span>
                ` : ''}
            </div>
        </div>

        <div class="stock-info">
            <div class="info-item">
                <div class="info-label">Date Noticed</div>
                <div class="info-value">${formatDate(stock.date_noticed)}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Price When Noticed</div>
                <div class="info-value">$${stock.price_noticed.toFixed(2)}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Current Price</div>
                <div class="info-value ${changeClass}">
                    ${stock.current_price ? `$${stock.current_price.toFixed(2)}` : 'N/A'}
                </div>
            </div>
        </div>

        <div class="historical-prices">
            ${createHistoricalItem('1 Day', stock.price_1d)}
            ${createHistoricalItem('1 Week', stock.price_1wk)}
            ${createHistoricalItem('1 Month', stock.price_1mo)}
            ${createHistoricalItem('3 Months', stock.price_3mo)}
        </div>

        ${stock.notes ? `
            <div class="stock-notes">${stock.notes}</div>
        ` : ''}

        <div class="stock-actions">
            <button class="btn btn-danger" onclick="deleteStock(${stock.id})">Delete</button>
        </div>
    `;

    return card;
}

// Create historical price item HTML
function createHistoricalItem(label, priceData) {
    if (!priceData || !priceData.price) {
        return `
            <div class="historical-item">
                <div class="historical-label">${label}</div>
                <div class="historical-value">--</div>
            </div>
        `;
    }

    return `
        <div class="historical-item">
            <div class="historical-label">${label}</div>
            <div class="historical-value">$${priceData.price.toFixed(2)}</div>
            <div class="historical-date">${formatDate(priceData.date)}</div>
        </div>
    `;
}

// Delete stock
async function deleteStock(id) {
    if (!confirm('Delete this stock?')) return;

    try {
        const response = await fetch(`${API_BASE}/api/stocks/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadStocks();
            showToast('Stock deleted', 'success');
        } else {
            showToast('Error deleting stock', 'error');
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Toast notification system
function showToast(message, type) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}
