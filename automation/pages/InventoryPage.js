class InventoryPage {
  constructor(page) {
    this.page = page;
    this.title = page.getByTestId('title');
    this.cartBadge = page.getByTestId('shopping-cart-badge');
    this.cartLink = page.getByTestId('shopping-cart-link');
    this.items = page.getByTestId('inventory-item');
  }

  addToCart(productName) {
    const slug = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return this.page.getByTestId(`add-to-cart-${slug}`).click();
  }

  removeFromCart(productName) {
    const slug = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return this.page.getByTestId(`remove-${slug}`).click();
  }
}

module.exports = { InventoryPage };
