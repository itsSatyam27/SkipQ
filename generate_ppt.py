import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_presentation():
    prs = Presentation()
    # 16:9 widescreen layout
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # Color Palette matching the Silver Oak University template
    DARK_MAROON = RGBColor(140, 35, 35)      # Primary Header/Banner Maroon
    DARK_NAVY = RGBColor(15, 23, 42)          # Primary Text Dark Navy
    MUTED_GRAY = RGBColor(100, 116, 139)      # Subtext Muted Gray
    LIGHT_BG = RGBColor(248, 250, 252)        # Background
    WHITE = RGBColor(255, 255, 255)
    SUCCESS_GREEN = RGBColor(16, 185, 129)

    DIAGRAMS_DIR = os.path.join(os.path.dirname(__file__), "assets", "diagrams")
    LOGO_PATH = os.path.join(os.path.dirname(__file__), "assets", "silver_oak_naac_logo_transparent.png")

    def add_common_header_footer(slide, slide_title, page_num):
        # Top Header line
        top_bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(0.08))
        top_bar.fill.solid()
        top_bar.fill.fore_color.rgb = DARK_MAROON
        top_bar.line.fill.background()

        # University Logo in top right corner (Official Emblem + NAAC with transparent bg)
        if os.path.exists(LOGO_PATH):
            slide.shapes.add_picture(LOGO_PATH, Inches(9.3), Inches(0.18), width=Inches(3.6))

        # Slide Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.75), Inches(11.733), Inches(0.8))
        tf = title_box.text_frame
        p = tf.paragraphs[0]
        p.text = slide_title
        p.font.bold = True
        p.font.size = Pt(32)
        p.font.color.rgb = DARK_NAVY
        p.alignment = PP_ALIGN.CENTER

        # Bottom Footer
        footer_box = slide.shapes.add_textbox(Inches(1.0), Inches(6.9), Inches(11.333), Inches(0.4))
        tf_foot = footer_box.text_frame
        p_f = tf_foot.paragraphs[0]
        p_f.text = "DEPARTMENT OF COMPUTER ENGINEERING  •  *Proprietary material of SILVER OAK UNIVERSITY"
        p_f.font.size = Pt(9.5)
        p_f.font.color.rgb = MUTED_GRAY
        p_f.alignment = PP_ALIGN.CENTER

        # Page number
        p_num = slide.shapes.add_textbox(Inches(12.0), Inches(6.9), Inches(1.0), Inches(0.4))
        p_n_tf = p_num.text_frame
        p_np = p_n_tf.paragraphs[0]
        p_np.text = str(page_num)
        p_np.font.size = Pt(9.5)
        p_np.font.color.rgb = MUTED_GRAY
        p_np.alignment = PP_ALIGN.RIGHT

    blank_layout = prs.slide_layouts[6]

    # ==========================================
    # SLIDE 1: TITLE SLIDE
    # ==========================================
    s1 = prs.slides.add_slide(blank_layout)

    if os.path.exists(LOGO_PATH):
        s1.shapes.add_picture(LOGO_PATH, Inches(9.3), Inches(0.2), width=Inches(3.6))

    tbox = s1.shapes.add_textbox(Inches(1.0), Inches(1.2), Inches(11.333), Inches(2.3))
    tf_t = tbox.text_frame
    tf_t.word_wrap = True

    p_cname = tf_t.paragraphs[0]
    p_cname.text = "Capstone Project / Major Project"
    p_cname.font.size = Pt(22)
    p_cname.font.color.rgb = MUTED_GRAY
    p_cname.alignment = PP_ALIGN.CENTER

    p_ccode = tf_t.add_paragraph()
    p_ccode.text = "Course Code: <Course Code>"
    p_ccode.font.size = Pt(18)
    p_ccode.font.color.rgb = DARK_MAROON
    p_ccode.alignment = PP_ALIGN.CENTER

    p_title = tf_t.add_paragraph()
    p_title.text = "SkipQ: Campus Canteen Pre-Ordering & Queue Optimization"
    p_title.font.bold = True
    p_title.font.size = Pt(28)
    p_title.font.color.rgb = DARK_NAVY
    p_title.alignment = PP_ALIGN.CENTER

    # Table
    rows, cols = 5, 2
    table_shape = s1.shapes.add_table(rows, cols, Inches(1.5), Inches(3.8), Inches(10.333), Inches(3.0))
    table = table_shape.table
    table.columns[0].width = Inches(3.8)
    table.columns[1].width = Inches(6.533)

    fields = [
        ("Group ID", "GRP-SQ-01"),
        ("Enrollment No", "[Your Enrollment Number(s)]"),
        ("Name", "[Student Name(s)]"),
        ("Branch", "Department of Computer Engineering"),
        ("Guide Name", "[Faculty Guide Name]")
    ]

    for idx, (label, val) in enumerate(fields):
        cell_lbl = table.cell(idx, 0)
        cell_val = table.cell(idx, 1)

        cell_lbl.text = label
        cell_val.text = val

        cell_lbl.fill.solid()
        cell_lbl.fill.fore_color.rgb = DARK_MAROON
        cell_val.fill.solid()
        cell_val.fill.fore_color.rgb = DARK_MAROON

        for c, txt in [(cell_lbl, label), (cell_val, val)]:
            p = c.text_frame.paragraphs[0]
            p.font.size = Pt(14)
            p.font.color.rgb = WHITE
            p.font.bold = True if c == cell_lbl else False

    # ==========================================
    # SLIDE 2: INDEX
    # ==========================================
    s2 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s2, "Index", 2)

    idx_box = s2.shapes.add_textbox(Inches(2.5), Inches(1.8), Inches(8.333), Inches(4.8))
    tf_idx = idx_box.text_frame
    index_items = [
        "Introduction",
        "Background and Motivation",
        "Relevance and Importance",
        "Literature Survey",
        "Objectives",
        "UML Diagrams",
        "Work carried out till date (Table format)",
        "Timeline Chart",
        "References"
    ]
    for i, item in enumerate(index_items):
        p = tf_idx.paragraphs[0] if i == 0 else tf_idx.add_paragraph()
        p.text = f"•   {item}"
        p.font.size = Pt(20)
        p.font.color.rgb = DARK_NAVY
        p.space_after = Pt(10)

    # ==========================================
    # SLIDE 3: INTRODUCTION (Simplified)
    # ==========================================
    s3 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s3, "Introduction", 3)

    intro_box = s3.shapes.add_textbox(Inches(1.5), Inches(2.0), Inches(10.333), Inches(4.5))
    tf_intro = intro_box.text_frame
    tf_intro.word_wrap = True

    intro_points = [
        "Campus Food Pre-Ordering Platform: Designed to eliminate long queue waiting times in college canteens.",
        "Peak-Hour Solution: Solves the heavy congestion that happens during short 15–30 minute lecture breaks.",
        "Dual-Role System: Combines a Student Radar for ordering with a live Canteen POS for food vendors.",
        "Zero Delivery Fee: Focused on student grab-and-go self pickup with real-time digital passes."
    ]
    for i, pt in enumerate(intro_points):
        p = tf_intro.paragraphs[0] if i == 0 else tf_intro.add_paragraph()
        p.text = f"•   {pt}"
        p.font.size = Pt(20)
        p.font.color.rgb = DARK_NAVY
        p.space_after = Pt(18)

    # ==========================================
    # SLIDE 4: BACKGROUND AND MOTIVATION (Simplified)
    # ==========================================
    s4 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s4, "Background and Motivation", 4)

    bg_box = s4.shapes.add_textbox(Inches(1.5), Inches(2.0), Inches(10.333), Inches(4.5))
    tf_bg = bg_box.text_frame
    tf_bg.word_wrap = True

    bg_points = [
        "Break-Time Rush: Hundreds of students rush to canteen counters at the exact same break time.",
        "Manual Bottlenecks: Physical queues at billing cause students to lose 15–20 minutes of break time.",
        "Paper Token Issues: Paper slips get lost, damaged, or miscalled during noisy peak hours.",
        "Motivation: Create a simple mobile solution to save student time and organize canteen orders."
    ]
    for i, pt in enumerate(bg_points):
        p = tf_bg.paragraphs[0] if i == 0 else tf_bg.add_paragraph()
        p.text = f"•   {pt}"
        p.font.size = Pt(20)
        p.font.color.rgb = DARK_NAVY
        p.space_after = Pt(18)

    # ==========================================
    # SLIDE 5: RELEVANCE AND IMPORTANCE (Simplified)
    # ==========================================
    s5 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s5, "Relevance and Importance", 5)

    rel_box = s5.shapes.add_textbox(Inches(1.5), Inches(2.0), Inches(10.333), Inches(4.5))
    tf_rel = rel_box.text_frame
    tf_rel.word_wrap = True

    rel_points = [
        "For Students: Order in advance, track cooking status, and pick up food without standing in line.",
        "For Canteen Vendors: View orders on a live screen, manage rush hours, and avoid order mix-ups.",
        "For College Campus: Reduces crowd congestion in dining areas and promotes a digital campus.",
        "Campus Geofencing: Prevents fake/remote orders by restricting ordering within campus boundaries."
    ]
    for i, pt in enumerate(rel_points):
        p = tf_rel.paragraphs[0] if i == 0 else tf_rel.add_paragraph()
        p.text = f"•   {pt}"
        p.font.size = Pt(20)
        p.font.color.rgb = DARK_NAVY
        p.space_after = Pt(18)

    # ==========================================
    # SLIDE 6: LITERATURE SURVEY (Simplified)
    # ==========================================
    s6 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s6, "Literature Survey", 6)

    rows, cols = 4, 3
    t_shape = s6.shapes.add_table(rows, cols, Inches(1.0), Inches(2.0), Inches(11.333), Inches(4.3))
    tbl = t_shape.table
    tbl.columns[0].width = Inches(2.8)
    tbl.columns[1].width = Inches(4.2)
    tbl.columns[2].width = Inches(4.333)

    headers = ["Feature", "Existing Apps (Zomato / Swiggy / POS)", "Proposed SkipQ System"]
    for j, h in enumerate(headers):
        c = tbl.cell(0, j)
        c.text = h
        c.fill.solid()
        c.fill.fore_color.rgb = DARK_MAROON
        p = c.text_frame.paragraphs[0]
        p.font.bold = True
        p.font.size = Pt(14)
        p.font.color.rgb = WHITE
        p.alignment = PP_ALIGN.CENTER

    survey_data = [
        ["Commission & Cost", "High 20–30% vendor cut + extra delivery charges", "Zero delivery fee, free & campus-focused"],
        ["Ordering Area", "City-wide delivery (no walking campus radius)", "Campus GPS geofencing (1500m radius limit)"],
        ["Pickup & Queue", "Physical paper tokens or delivery driver pickup", "Live Digital Pickup Pass with verification code"]
    ]

    for r_idx, row in enumerate(survey_data):
        for c_idx, val in enumerate(row):
            c = tbl.cell(r_idx + 1, c_idx)
            c.text = val
            c.fill.solid()
            c.fill.fore_color.rgb = RGBColor(241, 245, 249) if r_idx % 2 == 0 else WHITE
            p = c.text_frame.paragraphs[0]
            p.font.size = Pt(13)
            p.font.color.rgb = DARK_NAVY
            if c_idx == 0:
                p.font.bold = True

    # ==========================================
    # SLIDE 7: OBJECTIVES (Simplified)
    # ==========================================
    s7 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s7, "Objectives", 7)

    obj_box = s7.shapes.add_textbox(Inches(1.5), Inches(2.0), Inches(10.333), Inches(4.5))
    tf_obj = obj_box.text_frame
    tf_obj.word_wrap = True

    objectives = [
        "1. Build Dual Interfaces: Student Radar for quick ordering + Canteen POS for order management.",
        "2. GPS Geofencing: Ensure students can only order when they are present inside the campus.",
        "3. Live Order Tracking: Real-time order stages (Placed ➔ Cooking ➔ Ready for Pickup).",
        "4. Digital Pickup Pass: Secure token and verification code to guarantee accurate meal handover.",
        "5. Fast & Offline-First: Instant response with local data caching and sound alerts."
    ]
    for i, pt in enumerate(objectives):
        p = tf_obj.paragraphs[0] if i == 0 else tf_obj.add_paragraph()
        p.text = f"•   {pt}"
        p.font.size = Pt(18.5)
        p.font.color.rgb = DARK_NAVY
        p.space_after = Pt(14)

    # ==========================================
    # SLIDE 8: UML - USE CASE DIAGRAM (Simplified)
    # ==========================================
    s8 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s8, "UML Diagram - Use Case Diagram", 8)

    img_uc = os.path.join(DIAGRAMS_DIR, "use_case_diagram.png")
    if os.path.exists(img_uc):
        s8.shapes.add_picture(img_uc, Inches(0.8), Inches(1.5), width=Inches(6.8))

    uc_desc_box = s8.shapes.add_textbox(Inches(7.8), Inches(1.8), Inches(4.8), Inches(4.8))
    tf_uc = uc_desc_box.text_frame
    tf_uc.word_wrap = True

    p = tf_uc.paragraphs[0]
    p.text = "Key Roles & Actions:"
    p.font.bold = True
    p.font.size = Pt(18)
    p.font.color.rgb = DARK_MAROON
    p.space_after = Pt(10)

    uc_points = [
        "Student Actor:",
        "  • Browse canteen menus & diet tags",
        "  • Add food to cart & place order",
        "  • Show Digital Pass at counter",
        "Canteen Operator:",
        "  • Receive tickets on POS queue",
        "  • Update food cooking status",
        "  • Verify pass code & deliver meal",
        "GPS Service:",
        "  • Validates student is on campus"
    ]
    for it in uc_points:
        p_it = tf_uc.add_paragraph()
        p_it.text = f"• {it}" if not it.startswith("  •") else it
        p_it.font.size = Pt(14)
        p_it.font.color.rgb = DARK_NAVY
        p_it.space_after = Pt(4)

    # ==========================================
    # SLIDE 9: UML - CLASS DIAGRAM (Simplified)
    # ==========================================
    s9 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s9, "UML Diagram - Class Diagram", 9)

    img_cls = os.path.join(DIAGRAMS_DIR, "class_diagram.png")
    if os.path.exists(img_cls):
        s9.shapes.add_picture(img_cls, Inches(0.8), Inches(1.5), width=Inches(6.8))

    cls_desc_box = s9.shapes.add_textbox(Inches(7.8), Inches(1.8), Inches(4.8), Inches(4.8))
    tf_cls = cls_desc_box.text_frame
    tf_cls.word_wrap = True

    p = tf_cls.paragraphs[0]
    p.text = "Core Data Classes:"
    p.font.bold = True
    p.font.size = Pt(18)
    p.font.color.rgb = DARK_MAROON
    p.space_after = Pt(10)

    cls_points = [
        "Canteen Class:",
        "  • Name, location, rating, menu items",
        "MenuItem Class:",
        "  • Title, price, prep time, veg tag",
        "Order Class:",
        "  • Token number, status, verification code",
        "UserProfile Class:",
        "  • Student name, roll number, wallet",
        "GeoLocationEngine:",
        "  • Distance check (Haversine formula)"
    ]
    for it in cls_points:
        p_it = tf_cls.add_paragraph()
        p_it.text = f"• {it}" if not it.startswith("  •") else it
        p_it.font.size = Pt(14)
        p_it.font.color.rgb = DARK_NAVY
        p_it.space_after = Pt(4)

    # ==========================================
    # SLIDE 10: UML - SEQUENCE DIAGRAM (Simplified)
    # ==========================================
    s10 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s10, "UML Diagram - Sequence Diagram", 10)

    img_seq = os.path.join(DIAGRAMS_DIR, "sequence_diagram.png")
    if os.path.exists(img_seq):
        s10.shapes.add_picture(img_seq, Inches(0.8), Inches(1.5), width=Inches(6.8))

    seq_desc_box = s10.shapes.add_textbox(Inches(7.8), Inches(1.8), Inches(4.8), Inches(4.8))
    tf_seq = seq_desc_box.text_frame
    tf_seq.word_wrap = True

    p = tf_seq.paragraphs[0]
    p.text = "Step-by-Step Flow:"
    p.font.bold = True
    p.font.size = Pt(18)
    p.font.color.rgb = DARK_MAROON
    p.space_after = Pt(10)

    seq_points = [
        "1. Check Location: Validates student is within campus radius.",
        "2. Place Order: Student pays & order ticket is sent to POS.",
        "3. Cooking: Canteen marks order 'In-Prep'.",
        "4. Ready Alert: Student gets buzzer alert & dynamic pickup pass.",
        "5. Handover: Canteen checks pass code and completes order."
    ]
    for it in seq_points:
        p_it = tf_seq.add_paragraph()
        p_it.text = f"• {it}"
        p_it.font.size = Pt(14)
        p_it.font.color.rgb = DARK_NAVY
        p_it.space_after = Pt(6)

    # ==========================================
    # SLIDE 11: WORK CARRIED OUT TILL DATE (Simplified Table)
    # ==========================================
    s11 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s11, "Work carried out till date", 11)

    rows, cols = 6, 4
    t_work = s11.shapes.add_table(rows, cols, Inches(1.0), Inches(1.8), Inches(11.333), Inches(4.6))
    tbl_w = t_work.table
    tbl_w.columns[0].width = Inches(1.0)
    tbl_w.columns[1].width = Inches(3.5)
    tbl_w.columns[2].width = Inches(4.833)
    tbl_w.columns[3].width = Inches(2.0)

    w_headers = ["Sr. No.", "Module / Feature", "Description", "Status"]
    for j, h in enumerate(w_headers):
        c = tbl_w.cell(0, j)
        c.text = h
        c.fill.solid()
        c.fill.fore_color.rgb = DARK_MAROON
        p = c.text_frame.paragraphs[0]
        p.font.bold = True
        p.font.size = Pt(14)
        p.font.color.rgb = WHITE
        p.alignment = PP_ALIGN.CENTER

    work_data = [
        ["1", "Student Radar & Menu", "Campus canteen explorer, dietary filters, and food search", "Completed (100%)"],
        ["2", "GPS Geofencing Engine", "Location check using Haversine formula to block off-campus orders", "Completed (100%)"],
        ["3", "Canteen POS Terminal", "Live ticket queue with Rush Mode and menu stock toggle", "Completed (100%)"],
        ["4", "Digital Pass & History", "Dynamic QR token pass, countdown timer, and order receipts", "Completed (100%)"],
        ["5", "Real-Time Sync & Audio", "Instant multi-tab syncing with order ready buzzer alerts", "Completed (100%)"]
    ]

    for r_idx, row in enumerate(work_data):
        for c_idx, val in enumerate(row):
            c = tbl_w.cell(r_idx + 1, c_idx)
            c.text = val
            c.fill.solid()
            c.fill.fore_color.rgb = RGBColor(241, 245, 249) if r_idx % 2 == 0 else WHITE
            p = c.text_frame.paragraphs[0]
            p.font.size = Pt(13)
            p.font.color.rgb = DARK_NAVY
            if c_idx in [0, 3]:
                p.alignment = PP_ALIGN.CENTER
                if c_idx == 3:
                    p.font.bold = True
                    p.font.color.rgb = SUCCESS_GREEN

    # ==========================================
    # SLIDE 12: TIMELINE CHART (Simplified Table)
    # ==========================================
    s12 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s12, "Timeline Chart", 12)

    rows, cols = 6, 4
    t_time = s12.shapes.add_table(rows, cols, Inches(1.0), Inches(1.8), Inches(11.333), Inches(4.6))
    tbl_t = t_time.table
    tbl_t.columns[0].width = Inches(2.2)
    tbl_t.columns[1].width = Inches(4.633)
    tbl_t.columns[2].width = Inches(2.3)
    tbl_t.columns[3].width = Inches(2.2)

    time_headers = ["Phase", "Milestones / Deliverables", "Timeline", "Status"]
    for j, h in enumerate(time_headers):
        c = tbl_t.cell(0, j)
        c.text = h
        c.fill.solid()
        c.fill.fore_color.rgb = DARK_MAROON
        p = c.text_frame.paragraphs[0]
        p.font.bold = True
        p.font.size = Pt(14)
        p.font.color.rgb = WHITE
        p.alignment = PP_ALIGN.CENTER

    timeline_data = [
        ["Phase 1: Planning", "Literature study & canteen survey analysis", "Weeks 1 – 3", "Completed"],
        ["Phase 2: Architecture", "System design, UML diagrams & wireframes", "Weeks 4 – 6", "Completed"],
        ["Phase 3: Core App", "Student Radar, Canteen POS & Geofencing", "Weeks 7 – 10", "Completed"],
        ["Phase 4: Order Flow", "Cart, Digital Pass, Buzzer & Order History", "Weeks 11 – 13", "Completed"],
        ["Phase 5: Final Testing", "Pilot testing, performance polish & presentation", "Weeks 14 – 16", "Completed"]
    ]

    for r_idx, row in enumerate(timeline_data):
        for c_idx, val in enumerate(row):
            c = tbl_t.cell(r_idx + 1, c_idx)
            c.text = val
            c.fill.solid()
            c.fill.fore_color.rgb = RGBColor(241, 245, 249) if r_idx % 2 == 0 else WHITE
            p = c.text_frame.paragraphs[0]
            p.font.size = Pt(13)
            p.font.color.rgb = DARK_NAVY
            if c_idx in [0, 2, 3]:
                p.alignment = PP_ALIGN.CENTER
                if c_idx == 3:
                    p.font.bold = True
                    p.font.color.rgb = SUCCESS_GREEN

    # ==========================================
    # SLIDE 13: REFERENCES (Simplified)
    # ==========================================
    s13 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s13, "References", 13)

    ref_box = s13.shapes.add_textbox(Inches(1.2), Inches(2.0), Inches(10.933), Inches(4.5))
    tf_ref = ref_box.text_frame
    tf_ref.word_wrap = True

    references = [
        "[1] A. Kumar and S. Sharma, \"Optimizing Campus Canteen Ordering Systems Using Mobile Geofencing and Queue Theory,\" *IEEE Smart Tech Conference*, 2023.",
        "[2] R. Patel, K. Mehta, and N. Shah, \"Design of Micro-Commerce Platforms for Educational Campuses,\" *IJCA Journal*, vol. 182, 2022.",
        "[3] React Native Documentation, \"Building Cross-Platform Mobile Applications,\" Meta Open Source, 2024. [Online]. https://reactnative.dev",
        "[4] Expo Framework Guidelines, \"Location Services and State Management,\" Expo Docs, 2025. [Online]. https://docs.expo.dev"
    ]

    for i, ref in enumerate(references):
        p = tf_ref.paragraphs[0] if i == 0 else tf_ref.add_paragraph()
        p.text = ref
        p.font.size = Pt(15)
        p.font.color.rgb = DARK_NAVY
        p.space_after = Pt(16)

    output_path = os.path.join(os.path.dirname(__file__), "SkipQ_Project_Presentation.pptx")
    try:
        prs.save(output_path)
        print(f"Simplified presentation saved to: {output_path}")
    except PermissionError:
        output_path_v2 = os.path.join(os.path.dirname(__file__), "SkipQ_Project_Presentation_V2.pptx")
        prs.save(output_path_v2)
        print(f"Simplified presentation saved to: {output_path_v2}")

if __name__ == "__main__":
    create_presentation()
