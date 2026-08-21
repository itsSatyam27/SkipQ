import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches

# Ensure output directory exists
OUT_DIR = os.path.join(os.path.dirname(__file__), "assets", "diagrams")
os.makedirs(OUT_DIR, exist_ok=True)

# -------------------------------------------------------------
# 1. USE CASE DIAGRAM
# -------------------------------------------------------------
def generate_use_case_diagram():
    fig, ax = plt.subplots(figsize=(14, 9), dpi=300)
    ax.set_facecolor('#f8fafc')
    fig.patch.set_facecolor('#ffffff')
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 9)
    ax.axis('off')

    # System boundary box
    sys_box = patches.FancyBboxPatch((3.2, 0.4), 7.6, 8.0,
                                     boxstyle="round,pad=0.2",
                                     edgecolor='#8c2323', facecolor='#ffffff',
                                     linewidth=2.5, linestyle='-')
    ax.add_patch(sys_box)
    ax.text(7.0, 8.1, "SkipQ Campus Platform System Boundary", fontsize=14, fontweight='bold',
            color='#8c2323', ha='center', va='center')

    # Actors: Student & Canteen Seller & Location Service
    def draw_actor(x, y, name, color='#0f172a'):
        # Head
        ax.plot(x, y + 0.5, marker='o', markersize=14, color=color)
        # Body
        ax.plot([x, x], [y + 0.35, y - 0.15], color=color, lw=2.5)
        # Arms
        ax.plot([x - 0.3, x + 0.3], [y + 0.15, y + 0.15], color=color, lw=2.5)
        # Legs
        ax.plot([x, x - 0.25], [y - 0.15, y - 0.6], color=color, lw=2.5)
        ax.plot([x, x + 0.25], [y - 0.15, y - 0.6], color=color, lw=2.5)
        ax.text(x, y - 0.85, name, fontsize=12, fontweight='bold', color=color, ha='center')

    draw_actor(1.4, 6.2, "Student\n(Buyer)", '#1e3a8a')
    draw_actor(1.4, 2.5, "GPS / Geofence\nService", '#047857')
    draw_actor(12.4, 5.0, "Canteen Operator\n(Seller POS)", '#8c2323')

    # Use Cases (Ellipses)
    use_cases = [
        (7.0, 7.3, "UC-1: Select University & Campus", '#1e293b'),
        (7.0, 6.3, "UC-2: Explore Radar & Filter Menu", '#1e293b'),
        (7.0, 5.3, "UC-3: Cart Management & Order Placement", '#1e293b'),
        (7.0, 4.3, "UC-4: Verify Campus Geofencing Proximity", '#047857'),
        (7.0, 3.3, "UC-5: Display Dynamic Digital Pickup Pass", '#1e293b'),
        (7.0, 2.3, "UC-6: POS Queue Management (Kanban)", '#8c2323'),
        (7.0, 1.3, "UC-7: Dynamic Menu & Out-of-Stock Controls", '#8c2323'),
    ]

    for (ux, uy, text, col) in use_cases:
        ellipse = patches.Ellipse((ux, uy), 5.6, 0.72,
                                  edgecolor=col, facecolor='#f1f5f9', linewidth=1.8)
        ax.add_patch(ellipse)
        ax.text(ux, uy, text, fontsize=10.5, fontweight='bold', color=col, ha='center', va='center')

    # Connections: Student
    for uy in [7.3, 6.3, 5.3, 3.3]:
        ax.annotate('', xy=(4.2, uy), xytext=(1.8, 6.2),
                    arrowprops=dict(arrowstyle='->', color='#1e3a8a', lw=1.5))

    # GPS -> Geofence UC-4
    ax.annotate('', xy=(4.2, 4.3), xytext=(1.8, 2.5),
                arrowprops=dict(arrowstyle='->', color='#047857', lw=1.8))
    # UC-3 <<include>> UC-4
    ax.annotate('<<include>>', xy=(7.0, 4.68), xytext=(7.0, 4.92),
                fontsize=8.5, fontstyle='italic', color='#047857', ha='center')
    ax.annotate('', xy=(7.0, 4.68), xytext=(7.0, 4.92),
                arrowprops=dict(arrowstyle='->', linestyle='dashed', color='#047857', lw=1.5))

    # Seller -> UC-6, UC-7, UC-5 (Validation)
    ax.annotate('', xy=(9.8, 2.3), xytext=(12.0, 5.0),
                arrowprops=dict(arrowstyle='->', color='#8c2323', lw=1.5))
    ax.annotate('', xy=(9.8, 1.3), xytext=(12.0, 5.0),
                arrowprops=dict(arrowstyle='->', color='#8c2323', lw=1.5))
    ax.annotate('', xy=(9.8, 3.3), xytext=(12.0, 5.0),
                arrowprops=dict(arrowstyle='->', color='#8c2323', lw=1.5))

    plt.title("SkipQ Platform - Use Case Diagram", fontsize=16, fontweight='bold', pad=18, color='#0f172a')
    out_file = os.path.join(OUT_DIR, "use_case_diagram.png")
    plt.tight_layout()
    plt.savefig(out_file, bbox_inches='tight')
    plt.close()
    print(f"Saved: {out_file}")

# -------------------------------------------------------------
# 2. CLASS DIAGRAM
# -------------------------------------------------------------
def generate_class_diagram():
    fig, ax = plt.subplots(figsize=(15, 10), dpi=300)
    ax.set_facecolor('#f8fafc')
    fig.patch.set_facecolor('#ffffff')
    ax.set_xlim(0, 15)
    ax.set_ylim(0, 10)
    ax.axis('off')

    def draw_uml_class(x, y, w, h, name, attrs, methods, header_bg='#8c2323'):
        # Outer box
        box = patches.FancyBboxPatch((x, y - h), w, h,
                                     boxstyle="square,pad=0.0",
                                     edgecolor='#334155', facecolor='#ffffff', linewidth=1.5)
        ax.add_patch(box)
        # Header banner
        header_h = 0.55
        hdr = patches.Rectangle((x, y - header_h), w, header_h,
                                edgecolor='#334155', facecolor=header_bg, linewidth=1.5)
        ax.add_patch(hdr)
        ax.text(x + w/2.0, y - header_h/2.0, name, fontsize=11, fontweight='bold',
                color='#ffffff', ha='center', va='center')

        # Attributes section
        cur_y = y - header_h - 0.2
        for attr in attrs:
            ax.text(x + 0.15, cur_y, f"- {attr}", fontsize=8.5, color='#0f172a', family='monospace')
            cur_y -= 0.22

        # Separator line
        sep_y = cur_y - 0.05
        ax.plot([x, x + w], [sep_y, sep_y], color='#94a3b8', lw=1.0)
        cur_y = sep_y - 0.2

        # Methods section
        for m in methods:
            ax.text(x + 0.15, cur_y, f"+ {m}", fontsize=8.5, color='#1e3a8a', family='monospace')
            cur_y -= 0.22

    # Classes: Canteen, MenuItem, Order, CartItem, UserProfile, GeoLocationEngine
    draw_uml_class(0.8, 9.2, 3.8, 3.2, "Canteen",
                   ["id: String", "name: String", "location: GeoPoint", "rating: Float", "prepSpeedMin: Int", "isRushMode: Boolean"],
                   ["getMenu(): List<MenuItem>", "toggleRushMode()", "updateOrderStatus()"], '#8c2323')

    draw_uml_class(5.6, 9.2, 3.8, 3.2, "MenuItem",
                   ["id: String", "canteenId: String", "title: String", "price: Float", "prepTime: Int", "isVeg: Boolean", "inStock: Boolean"],
                   ["toggleStock()", "updatePrice(newP)"], '#8c2323')

    draw_uml_class(10.4, 9.2, 3.8, 3.4, "GeoLocationEngine",
                   ["userLat: Double", "userLng: Double", "maxCampusRadius: Int = 1500"],
                   ["calcDistance(lat1, lon1, lat2, lon2): Double", "isInsideCampus(): Boolean", "requestPermissions()"], '#047857')

    draw_uml_class(0.8, 4.8, 3.8, 3.8, "Order",
                   ["id: String", "tokenNo: String", "items: List<CartItem>", "totalAmount: Float", "orderStatus: Enum", "verificationCode: String", "orderTime: Timestamp"],
                   ["calculateTotal(): Float", "advanceStatus()", "markUnclaimed()", "generatePass()"], '#1e3a8a')

    draw_uml_class(5.6, 4.8, 3.8, 3.2, "CartItem",
                   ["itemId: String", "title: String", "qty: Int", "unitPrice: Float", "instructions: String"],
                   ["incrementQty()", "decrementQty()", "getSubtotal(): Float"], '#1e3a8a')

    draw_uml_class(10.4, 4.8, 3.8, 3.6, "UserProfile",
                   ["rollNo: String", "name: String", "phone: String", "walletBalance: Float", "unclaimedCount: Int", "banStatus: Enum", "banUntil: Timestamp"],
                   ["deductWallet(amt)", "addUnclaimedPenalty()", "checkBanStatus(): Boolean"], '#475569')

    # Relationships / Connectors
    # Canteen 1 -- * MenuItem
    ax.annotate('', xy=(5.6, 8.0), xytext=(4.6, 8.0),
                arrowprops=dict(arrowstyle='->', color='#334155', lw=1.8))
    ax.text(4.8, 8.15, "1..* has", fontsize=9, fontweight='bold', color='#334155')

    # Order 1 -- * CartItem
    ax.annotate('', xy=(5.6, 3.2), xytext=(4.6, 3.2),
                arrowprops=dict(arrowstyle='->', color='#334155', lw=1.8))
    ax.text(4.8, 3.35, "1..* contains", fontsize=9, fontweight='bold', color='#334155')

    # UserProfile 1 -- * Order
    ax.annotate('', xy=(4.6, 2.0), xytext=(10.4, 2.0),
                arrowprops=dict(arrowstyle='->', color='#334155', lw=1.8))
    ax.text(7.2, 2.15, "places 1..* orders", fontsize=9, fontweight='bold', color='#334155', ha='center')

    # Order utilizes GeoLocationEngine
    ax.annotate('', xy=(12.3, 5.8), xytext=(4.6, 4.0),
                arrowprops=dict(arrowstyle='->', linestyle='dashed', color='#047857', lw=1.5))
    ax.text(8.0, 5.0, "<<validates location>>", fontsize=8.5, fontstyle='italic', color='#047857')

    plt.title("SkipQ Platform - Class Diagram Architecture", fontsize=16, fontweight='bold', pad=18, color='#0f172a')
    out_file = os.path.join(OUT_DIR, "class_diagram.png")
    plt.tight_layout()
    plt.savefig(out_file, bbox_inches='tight')
    plt.close()
    print(f"Saved: {out_file}")

# -------------------------------------------------------------
# 3. SEQUENCE DIAGRAM
# -------------------------------------------------------------
def generate_sequence_diagram():
    fig, ax = plt.subplots(figsize=(15, 10), dpi=300)
    ax.set_facecolor('#f8fafc')
    fig.patch.set_facecolor('#ffffff')
    ax.set_xlim(0, 15)
    ax.set_ylim(0, 11)
    ax.axis('off')

    # Lifelines: Student, GeofenceValidator, OrderEngine/Cart, CanteenPOS, KitchenQueue
    lifelines = [
        (1.8, "Student / App UI", '#1e3a8a'),
        (4.8, "Geofence Engine", '#047857'),
        (7.8, "Order Context / App", '#475569'),
        (10.8, "Canteen POS Terminal", '#8c2323'),
        (13.5, "Kitchen / Pickup Counter", '#b91c1c')
    ]

    for (x, name, col) in lifelines:
        # Header Box
        hdr = patches.Rectangle((x - 1.2, 9.8), 2.4, 0.7,
                                edgecolor=col, facecolor=col, linewidth=1.5)
        ax.add_patch(hdr)
        ax.text(x, 10.15, name, fontsize=9.5, fontweight='bold', color='#ffffff', ha='center', va='center')
        # Dashed line
        ax.plot([x, x], [9.8, 0.6], linestyle='--', color='#94a3b8', lw=1.5)

    # Sequence Messages
    messages = [
        (1, 1.8, 4.8, 9.2, "1: getCoordinates()", '#0f172a', True),
        (2, 4.8, 1.8, 8.6, "2: isWithinCampusRadius(true)", '#047857', False),
        (3, 1.8, 7.8, 8.0, "3: addItemsToCart() & submitOrder()", '#1e3a8a', True),
        (4, 7.8, 7.8, 7.4, "4: deductWallet() & genToken()", '#475569', True, True),
        (5, 7.8, 10.8, 6.7, "5: pushOrderToQueue(status: 'Pending')", '#8c2323', True),
        (6, 10.8, 13.5, 6.0, "6: sendToKitchenTicket(status: 'In-Prep')", '#b91c1c', True),
        (7, 10.8, 1.8, 5.3, "7: emitStatusUpdate('In-Prep')", '#1e3a8a', False),
        (8, 13.5, 10.8, 4.5, "8: markFoodReady()", '#b91c1c', True),
        (9, 10.8, 1.8, 3.8, "9: notifyReadyBuzzer() & activatePass()", '#047857', False),
        (10, 1.8, 13.5, 2.9, "10: presentDigitalPass(verificationCode)", '#1e3a8a', True),
        (11, 13.5, 10.8, 2.0, "11: verifyCodeAndHandoverMeal()", '#8c2323', True),
        (12, 10.8, 1.8, 1.2, "12: markOrderCompleted()", '#047857', False)
    ]

    for msg in messages:
        num, x1, x2, y, text, col, is_solid = msg[0], msg[1], msg[2], msg[3], msg[4], msg[5], msg[6]
        is_self = len(msg) > 7 and msg[7]

        if is_self:
            # Self loop
            ax.plot([x1, x1 + 0.8, x1 + 0.8, x1], [y, y, y - 0.35, y - 0.35], color=col, lw=1.6)
            ax.annotate('', xy=(x1, y - 0.35), xytext=(x1 + 0.1, y - 0.35),
                        arrowprops=dict(arrowstyle='->', color=col, lw=1.6))
            ax.text(x1 + 0.9, y - 0.18, text, fontsize=8.5, fontweight='bold', color=col, va='center')
        else:
            style = '-' if is_solid else '--'
            ax.annotate('', xy=(x2, y), xytext=(x1, y),
                        arrowprops=dict(arrowstyle='->', linestyle=style, color=col, lw=1.6))
            mid_x = (x1 + x2) / 2.0
            ax.text(mid_x, y + 0.12, text, fontsize=8.5, fontweight='bold', color=col, ha='center')

    plt.title("SkipQ Platform - End-to-End Order & Verification Sequence", fontsize=16, fontweight='bold', pad=18, color='#0f172a')
    out_file = os.path.join(OUT_DIR, "sequence_diagram.png")
    plt.tight_layout()
    plt.savefig(out_file, bbox_inches='tight')
    plt.close()
    print(f"Saved: {out_file}")

if __name__ == "__main__":
    generate_use_case_diagram()
    generate_class_diagram()
    generate_sequence_diagram()
