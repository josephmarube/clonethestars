const FILTER_STORAGE_KEY = 'nyc_mobility_filters';

function getCurrentFilters() {
  return {
    date: document.getElementById('global-date')?.value,
    borough: document.getElementById('borough-filter')?.value || 'all',
    minFare: parseFloat(document.getElementById('min-fare')?.value) || 0,
    maxFare: parseFloat(document.getElementById('max-fare')?.value) || Infinity,
    minDistance: parseFloat(document.getElementById('min-distance')?.value) || 0,
    maxDistance: parseFloat(document.getElementById('max-distance')?.value) || Infinity,
    hour: document.getElementById('hour-filter')?.value || 'all',
  };
}

function saveFilterInputs() {
  try {
    sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
      date: document.getElementById('global-date')?.value,
      borough: document.getElementById('borough-filter')?.value,
      minFare: document.getElementById('min-fare')?.value,
      maxFare: document.getElementById('max-fare')?.value,
      minDistance: document.getElementById('min-distance')?.value,
      maxDistance: document.getElementById('max-distance')?.value,
      hour: document.getElementById('hour-filter')?.value,
    }));
  } catch (e) {
    // sessionStorage unavailable - filters just won't survive reload
  }
}

function restoreFilterInputs() {
  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(FILTER_STORAGE_KEY));
  } catch (e) {
    return false;
  }
  if (!saved) return false;

  if (saved.date) document.getElementById('global-date').value = saved.date;
  if (saved.borough) document.getElementById('borough-filter').value = saved.borough;
  if (saved.minFare) document.getElementById('min-fare').value = saved.minFare;
  if (saved.maxFare) document.getElementById('max-fare').value = saved.maxFare;
  if (saved.minDistance) document.getElementById('min-distance').value = saved.minDistance;
  if (saved.maxDistance) document.getElementById('max-distance').value = saved.maxDistance;
  if (saved.hour) document.getElementById('hour-filter').value = saved.hour;
  return true;
}

function applyFilters() {
  const filters = getCurrentFilters();
  saveFilterInputs();

  DataAPI.getTrips(filters)
    .then(trips => {
      renderTripsTable(trips);
      window.__lastFilteredTrips = trips;
    })
    .catch(err => {
      const tbody = document.querySelector('#trips-table tbody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" class="trips-table__loading">Couldn't load trips: ${err.message}</td></tr>`;
      }
      window.__lastFilteredTrips = [];
    });
}

function resetFilters() {
  document.getElementById('borough-filter').value = 'all';
  document.getElementById('min-fare').value = '0';
  document.getElementById('max-fare').value = '600';
  document.getElementById('min-distance').value = '0';
  document.getElementById('max-distance').value = '50';
  document.getElementById('hour-filter').value = 'all';
  applyFilters();
}

// ── CSV export ───────────────────────────────────────────────────────

function exportTripsCsv() {
  const trips = window.__lastFilteredTrips || [];
  if (!trips.length) {
    console.warn('[filters] no trips to export');
    return;
  }

  const headers = ['pickup', 'dropoff', 'pu_zone', 'do_zone', 'distance', 'fare', 'tip', 'total'];
  const rows = trips.map(t => headers.map(h => {
    const val = t[h];
    // wrap strings containing commas in quotes
    return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
  }).join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'filtered_trips.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('apply-filters-btn')?.addEventListener('click', applyFilters);
  document.getElementById('reset-filters-btn')?.addEventListener('click', resetFilters);
  document.getElementById('export-csv-btn')?.addEventListener('click', exportTripsCsv);
  document.getElementById('borough-filter')?.addEventListener('change', applyFilters);

  var restored = restoreFilterInputs();
  if (restored) {
    applyFilters();
  }
});