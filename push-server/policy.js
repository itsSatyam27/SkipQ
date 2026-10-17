export function notificationFor(order, actor, event) {
  if (event === 'created' && order.buyerId === actor && order.orderStatus === 'Preparing') {
    return { uid: order.sellerId, title: 'New SkipQ order', body: `Token ${order.tokenNumber}: a new order is waiting in your kitchen.` };
  }
  if (event === 'ready' && order.sellerId === actor && order.orderStatus === 'Ready for Pickup') {
    return { uid: order.buyerId, title: 'Your order is ready', body: `Collect token ${order.tokenNumber} from ${order.shopName}.` };
  }
  throw new Error('This account cannot send this order notification.');
}
