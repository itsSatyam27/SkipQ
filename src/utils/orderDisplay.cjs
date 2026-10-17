function parseOrderDate(value) {
  if (value == null || value === '') return null;
  let date;
  try {
    if (typeof value.toDate === 'function') date = value.toDate();
    else if (typeof value.toMillis === 'function') date = new Date(value.toMillis());
    else if (typeof value === 'object' && Number.isFinite(value.seconds ?? value._seconds)) date = new Date((value.seconds ?? value._seconds) * 1000 + (value.nanoseconds ?? value._nanoseconds ?? 0) / 1e6);
    else if (value instanceof Date) date = value;
    else if (typeof value === 'string' || typeof value === 'number') date = new Date(value);
    return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
  } catch { return null; }
}
function orderDate(order) {
  for (const value of [order.createdAt, order.timestamp, order.orderTime]) {
    const date = parseOrderDate(value);
    if (date) return date;
  }
  return null;
}
function prepMinutes(value) {
  const match = String(value ?? '').match(/\d+/);
  return match ? Number(match[0]) : 5;
}
function prepLabel(value) {
  const minutes = prepMinutes(value);
  return minutes === 0 ? 'Ready to serve' : `${minutes} ${minutes === 1 ? 'min' : 'mins'}`;
}
function itemCountLabel(count) { return `${count} ${count === 1 ? 'item' : 'items'}`; }
module.exports = { parseOrderDate, orderDate, prepMinutes, prepLabel, itemCountLabel };
