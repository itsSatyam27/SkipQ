function pickupShareData(order, shop) {
  if (!order || ['Completed', 'Cancelled', 'Abandoned'].includes(order.orderStatus)) throw new Error('This order is no longer available for handover.');
  if (!/^\d{4}$/.test(String(order.pickupPin || ''))) throw new Error('Wait for your pickup PIN to load.');
  const money = value => `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const delivery = order.staffRoomDelivery === true;
  const verified = ['CONFIRMED_BY_MERCHANT', 'CASH_COLLECTED'].includes(order.paymentStatus);
  const advanceVerified = order.advancePaymentStatus === 'CONFIRMED_BY_MERCHANT';
  const payment = verified ? 'Payment verified by canteen'
    : order.paymentMethod === 'Cash' && (!order.advanceAmount || advanceVerified)
      ? `${money(advanceVerified ? order.dueAtCounter ?? order.totalAmount : order.totalAmount)} cash ${delivery ? 'on delivery' : 'at pickup'}`
      : 'Payment verification pending — confirm with canteen';
  return {
    title: delivery ? 'Delivery pass' : 'Pickup pass', shop: order.shopName || shop?.name || 'Campus canteen',
    token: String(order.tokenNumber || '—'), pin: String(order.pickupPin),
    location: delivery ? order.facultyRoomNote || 'Confirm delivery location with buyer' : shop?.location || 'Collect at the canteen counter',
    locationLabel: delivery ? 'DELIVER TO' : 'PICKUP LOCATION', payment,
    items: (order.items || []).map(item => ({ name: String(item.name || 'Dish'), qty: item.qty })),
    instruction: delivery ? 'Show this PIN to delivery staff at handover.' : 'Show this PIN at the counter to collect the order.',
    note: 'Shared copy · Check readiness with the buyer. Confirm payment with the canteen.',
  };
}
module.exports = { pickupShareData };
