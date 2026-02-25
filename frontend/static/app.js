const API_BASE = '';
const chartInstances = {};
const hiddenEntries = new Set(JSON.parse(localStorage.getItem('hiddenEntries') || '[]'));
let lastLoadedStocks = null;

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
    let priceNoticed = parseFloat(document.getElementById('priceNoticed').value);
    const notes = document.getElementById('notes').value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    try {
        // Auto-fetch price if not yet fetched
        if (!priceNoticed || priceNoticed === 0) {
            const priceResp = await fetch(`${API_BASE}/api/price/${symbol}`);
            if (priceResp.ok) {
                const priceData = await priceResp.json();
                priceNoticed = priceData.price;
                document.getElementById('priceNoticed').value = priceNoticed;
            } else {
                showToast(`Could not fetch price for ${symbol}`, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add Stock';
                return;
            }
        }
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
            lastFetchedSymbol = '';
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

// Auto-fetch current price when symbol is entered
let lastFetchedSymbol = '';
document.getElementById('symbol').addEventListener('blur', async () => {
    const symbol = document.getElementById('symbol').value.trim().toUpperCase();
    if (!symbol || symbol === lastFetchedSymbol) return;

    try {
        const response = await fetch(`${API_BASE}/api/price/${symbol}`);
        if (response.ok) {
            const data = await response.json();
            document.getElementById('priceNoticed').value = data.price;
            lastFetchedSymbol = symbol;
        }
    } catch (error) {
        // Silently fail — price will be fetched on submit if needed
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

    // Destroy existing chart instances to prevent memory leaks
    for (const id of Object.keys(chartInstances)) {
        chartInstances[id].destroy();
        delete chartInstances[id];
    }

    loading.style.display = 'block';
    container.innerHTML = '';

    try {
        const response = await fetch(`${API_BASE}/api/stocks`);
        const stocks = await response.json();
        lastLoadedStocks = stocks;

        loading.style.display = 'none';

        if (stocks.length === 0) {
            container.innerHTML = '<p class="loading">No stocks tracked yet. Add one above.</p>';
            return;
        }

        stocks.forEach(stock => {
            container.appendChild(createStockCard(stock));
        });

        // Render charts from bundled data (no extra API calls)
        stocks.forEach(stock => {
            if (stock.chart_data && stock.chart_data.length > 0) {
                renderChart(`sym-${stock.symbol}`, stock.chart_data);
            } else {
                loadChart(`sym-${stock.symbol}`, stock.symbol, '1mo');
            }
        });
    } catch (error) {
        loading.style.display = 'none';
        container.innerHTML = `<p class="loading">Error loading stocks: ${error.message}</p>`;
    }
}

// Create a stock card element (stock is now a grouped object with entries[])
function createStockCard(stock) {
    const card = document.createElement('div');
    card.className = 'stock-card';

    const cardId = `sym-${stock.symbol}`;

    const visibleEntries = stock.entries.filter(e => !hiddenEntries.has(e.id));
    const hiddenCount = stock.entries.length - visibleEntries.length;

    card.innerHTML = `
        <div class="stock-header">
            <div class="stock-symbol">${stock.symbol}</div>
            <div class="stock-header-right">
                <div class="stock-current-price">
                    ${stock.current_price ? `$${stock.current_price.toFixed(2)}` : 'N/A'}
                </div>
                <button class="btn-remove" data-symbol="${stock.symbol}" title="Stop tracking ${stock.symbol}">×</button>
            </div>
        </div>

        <div class="chart-container" id="chart-container-${cardId}">
            <div class="chart-header">
                <span class="chart-title">Price History</span>
                <div class="chart-period-buttons">
                    <button class="btn-period active" data-stock-id="${cardId}" data-symbol="${stock.symbol}" data-period="1mo">1M</button>
                    <button class="btn-period" data-stock-id="${cardId}" data-symbol="${stock.symbol}" data-period="3mo">3M</button>
                    <button class="btn-period" data-stock-id="${cardId}" data-symbol="${stock.symbol}" data-period="6mo">6M</button>
                    <button class="btn-period" data-stock-id="${cardId}" data-symbol="${stock.symbol}" data-period="1yr">1Y</button>
                </div>
            </div>
            <div class="chart-loading" id="chart-loading-${cardId}">Loading chart...</div>
            <canvas id="chart-${cardId}"></canvas>
        </div>

        <div class="entries-section">
            <div class="entries-header">Notices</div>
            <div class="entries-list">
                ${visibleEntries.map(entry => {
                    const hasChange = entry.change !== undefined;
                    const badgeClass = hasChange && entry.change >= 0 ? 'change-positive' : 'change-negative';
                    const sign = hasChange && entry.change >= 0 ? '+' : '';
                    return `
                        <div class="entry-row">
                            <div class="entry-info">
                                <span class="entry-date">${formatDate(entry.date_noticed)}</span>
                                <span class="entry-price">$${entry.price_noticed.toFixed(2)}</span>
                                ${hasChange ? `<span class="change-badge ${badgeClass}">${sign}$${entry.change} (${sign}${entry.change_percent}%)</span>` : ''}
                            </div>
                            <div class="entry-actions">
                                ${entry.notes ? `<span class="entry-notes">${entry.notes}</span>` : ''}
                                <button class="btn-hide" data-entry-id="${entry.id}" title="Hide this notice">hide</button>
                            </div>
                        </div>
                    `;
                }).join('')}
                ${hiddenCount > 0 ? `<button class="btn-show-hidden" data-symbol="${stock.symbol}">${hiddenCount} hidden — show all</button>` : ''}
            </div>
        </div>
    `;

    return card;
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

// Render chart from data array [{date, price}, ...]
function renderChart(stockId, data) {
    const canvas = document.getElementById(`chart-${stockId}`);
    const loadingEl = document.getElementById(`chart-loading-${stockId}`);
    if (!canvas) return;

    if (!data || data.length === 0) {
        loadingEl.textContent = 'No chart data available';
        loadingEl.style.display = 'block';
        canvas.style.display = 'none';
        return;
    }

    loadingEl.style.display = 'none';
    canvas.style.display = 'block';

    const labels = data.map(d => d.date);
    const prices = data.map(d => d.price);
    const isUptrend = prices[prices.length - 1] >= prices[0];
    const lineColor = isUptrend ? '#4ade80' : '#f87171';
    const fillColor = isUptrend ? 'rgba(74, 222, 128, 0.08)' : 'rgba(248, 113, 113, 0.08)';

    if (chartInstances[stockId]) {
        chartInstances[stockId].destroy();
    }

    chartInstances[stockId] = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data: prices,
                borderColor: lineColor,
                backgroundColor: fillColor,
                borderWidth: 2,
                fill: true,
                pointRadius: 0,
                pointHitRadius: 8,
                tension: 0.3,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1a1a',
                    titleColor: '#888',
                    bodyColor: '#e0e0e0',
                    borderColor: '#333',
                    borderWidth: 1,
                    titleFont: { size: 11 },
                    bodyFont: { size: 13, weight: '600' },
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        label: ctx => `$${ctx.parsed.y.toFixed(2)}`
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#555',
                        maxTicksLimit: 6,
                        font: { size: 10 },
                    },
                    grid: { display: false },
                    border: { display: false },
                },
                y: {
                    position: 'right',
                    ticks: {
                        color: '#555',
                        maxTicksLimit: 5,
                        font: { size: 10 },
                        callback: v => '$' + v.toFixed(0),
                    },
                    grid: {
                        color: 'rgba(255,255,255,0.04)',
                    },
                    border: { display: false },
                }
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
        }
    });
}

// Load chart via API (used for period switching)
async function loadChart(stockId, symbol, period) {
    const loadingEl = document.getElementById(`chart-loading-${stockId}`);
    const canvas = document.getElementById(`chart-${stockId}`);
    if (!canvas) return;

    loadingEl.style.display = 'block';
    canvas.style.display = 'none';

    try {
        const response = await fetch(`${API_BASE}/api/history/${symbol}?period=${period}`);
        const result = await response.json();
        renderChart(stockId, result.data);
    } catch (error) {
        loadingEl.textContent = 'Failed to load chart';
        loadingEl.style.display = 'block';
        canvas.style.display = 'none';
    }
}

// Event delegation for stocksContainer buttons
document.getElementById('stocksContainer').addEventListener('click', async (e) => {
    // Period buttons
    const periodBtn = e.target.closest('.btn-period');
    if (periodBtn) {
        const { stockId, symbol, period } = periodBtn.dataset;
        const container = periodBtn.closest('.chart-period-buttons');
        container.querySelectorAll('.btn-period').forEach(b => b.classList.remove('active'));
        periodBtn.classList.add('active');
        loadChart(stockId, symbol, period);
        return;
    }

    // Hide notice
    const hideBtn = e.target.closest('.btn-hide');
    if (hideBtn) {
        const id = Number(hideBtn.dataset.entryId);
        hiddenEntries.add(id);
        localStorage.setItem('hiddenEntries', JSON.stringify([...hiddenEntries]));
        loadStocks();
        return;
    }

    // Show all hidden notices for a symbol
    const showBtn = e.target.closest('.btn-show-hidden');
    if (showBtn) {
        // Unhide all entries for this symbol by reloading with no filter
        // We need the stock data, so just clear hidden for entries in this card
        const card = showBtn.closest('.stock-card');
        card.querySelectorAll('.btn-hide').forEach(b => {
            hiddenEntries.delete(Number(b.dataset.entryId));
        });
        // Also unhide the ones currently hidden — get from cached stocks
        if (lastLoadedStocks) {
            const symbol = showBtn.dataset.symbol;
            const group = lastLoadedStocks.find(s => s.symbol === symbol);
            if (group) {
                group.entries.forEach(e => hiddenEntries.delete(e.id));
            }
        }
        localStorage.setItem('hiddenEntries', JSON.stringify([...hiddenEntries]));
        loadStocks();
        return;
    }

    // Remove stock (stop tracking)
    const removeBtn = e.target.closest('.btn-remove');
    if (removeBtn) {
        const symbol = removeBtn.dataset.symbol;
        if (!confirm(`Stop tracking ${symbol}? This removes all notices.`)) return;
        try {
            const resp = await fetch(`${API_BASE}/api/stocks/symbol/${symbol}`, { method: 'DELETE' });
            if (resp.ok) {
                showToast(`${symbol} removed`, 'success');
                loadStocks();
            } else {
                showToast('Error removing stock', 'error');
            }
        } catch (err) {
            showToast(`Error: ${err.message}`, 'error');
        }
    }
});

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
