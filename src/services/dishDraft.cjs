const DISH_CATEGORIES = ['Snacks', 'Beverages', 'Meals', 'Rolls', 'Sandwiches', 'Desserts'];
function validateDishDraft(draft) {
  const name = String(draft.name || '').trim();
  if (!name || name.length > 100) throw new Error('Enter a dish name of up to 100 characters.');
  const rawPrice = String(draft.price || '').trim();
  const price = Number(rawPrice);
  if (!/^\d+(\.\d{1,2})?$/.test(rawPrice) || !Number.isFinite(price) || price <= 0 || price > 100000) throw new Error('Enter a price between 0.01 and 100000, with up to two decimal places.');
  const minutes = String(draft.minutes ?? '').trim();
  if (!/^\d{1,3}$/.test(minutes) || Number(minutes) > 180) throw new Error('Enter a preparation time from 0 to 180 minutes.');
  if (!DISH_CATEGORIES.includes(draft.category)) throw new Error('Select a category for this dish.');
  const image = String(draft.image || '');
  if (image && !(image.startsWith('https://') || /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image))) throw new Error('Choose a valid dish photo.');
  if (image.startsWith('data:') && image.length > 60030) throw new Error('Dish photo is too large. Choose a smaller photo.');
  return { ...(image || draft.image === '' ? { image } : {}), name, price, category: draft.category, isVeg: draft.isVeg === true,
    prepTime: `${Number(minutes)} mins`, description: String(draft.description || '').trim().slice(0, 500) || 'Freshly prepared at counter.' };
}
module.exports = { DISH_CATEGORIES, validateDishDraft };
