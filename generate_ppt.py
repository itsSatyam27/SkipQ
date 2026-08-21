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

    # Color Palette matching the Silver Oak University header/footer template
    DARK_MAROON = RGBColor(140, 35, 35)      # Primary Header/Banner Maroon
    DARK_NAVY = RGBColor(15, 23, 42)          # Primary Text Dark Navy/Slate
    MUTED_GRAY = RGBColor(100, 116, 139)      # Subtext Muted Gray
    LIGHT_BG = RGBColor(248, 250, 252)        # Background
    ACCENT_RED = RGBColor(185, 28, 28)       # Accent
    WHITE = RGBColor(255, 255, 255)

    DIAGRAMS_DIR = os.path.join(os.path.dirname(__file__), "assets", "diagrams")

    LOGO_PATH = os.path.join(os.path.dirname(__file__), "assets", "silver_oak_naac_logo_transparent.png")

    def add_common_header_footer(slide, slide_title, page_num):
        # Top Header line
        top_bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(0.08))
        top_bar.fill.solid()
        top_bar.fill.fore_color.rgb = DARK_MAROON
        top_bar.line.fill.background()

        # University Logo in top right corner (Official Emblem + NAAC)
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
        p_f.text = f"DEPARTMENT OF COMPUTER ENGINEERING  •  *Proprietary material of SILVER OAK UNIVERSITY"
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

    # University Logo in top right corner (Official Emblem + NAAC)
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
    p_title.text = "SkipQ: Geofenced Campus Canteen Pre-Ordering & Queue Optimization Platform"
    p_title.font.bold = True
    p_title.font.size = Pt(28)
    p_title.font.color.rgb = DARK_NAVY
    p_title.alignment = PP_ALIGN.CENTER

    # Student Details Table
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
        "UML Diagrams (Use Case, Class, Sequence)",
        "Work carried out till date (Table format)",
        "Timeline Chart",
        "References"
    ]
    for i, item in enumerate(index_items):
        p = tf_idx.paragraphs[0] if i == 0 else tf_idx.add_paragraph()
        p.text = f"•   {item}"
        p.font.size = Pt(18)
        p.font.color.rgb = DARK_NAVY
        p.space_after = Pt(8)

    # ==========================================
    # SLIDE 3: INTRODUCTION
    # ==========================================
    s3 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s3, "Introduction", 3)

    intro_box = s3.shapes.add_textbox(Inches(1.2), Inches(1.8), Inches(10.933), Inches(4.8))
    tf_intro = intro_box.text_frame
    tf_intro.word_wrap = True

    intro_points = [
        "Research Domain: Mobile Application Architecture, Localized Micro-Commerce, and Queueing Optimization in high-density institutional dining environments.",
        "Problem Statement: Higher education campuses face massive peak-hour dining congestion during designated 15–30 minute break windows, causing physical queue delays and lost instructional time.",
        "SkipQ Concept: An end-to-end geofenced pre-ordering platform combining a Student Radar interface with a real-time Canteen POS (Point of Sale) terminal.",
        "Core Philosophy: Zero-delivery campus self-pickup with live kitchen status, transparent preparation time estimation, and automated anti-hoarding queue management."
    ]
    for i, pt in enumerate(intro_points):
        p = tf_intro.paragraphs[0] if i == 0 else tf_intro.add_paragraph()
        p.text = f"•   {pt}"
        p.font.size = Pt(16)
        p.font.color.rgb = DARK_NAVY
        p.space_after = Pt(12)

    # ==========================================
    # SLIDE 4: BACKGROUND AND MOTIVATION
    # ==========================================
    s4 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s4, "Background and Motivation", 4)

    bg_box = s4.shapes.add_textbox(Inches(1.2), Inches(1.8), Inches(10.933), Inches(4.8))
    tf_bg = bg_box.text_frame
    tf_bg.word_wrap = True

    bg_points = [
        "Peak Synchronized Demand: College schedules release thousands of students simultaneously, overwhelming campus canteen billing counters.",
        "Manual Bottlenecks & Operational Chaos: Paper tokens lead to lost receipts, order mix-ups, verbal announcement miscommunication, and untracked kitchen queues.",
        "Commercial Platform Incompatibility: Public food delivery platforms (Zomato/Swiggy) charge high commissions (25-30%), demand high delivery fees, and fail to accommodate internal campus walking patterns.",
        "Motivation: To engineer a localized, cost-effective campus ecosystem empowering students to skip lines while enabling canteen vendors to level kitchen load effectively."
    ]
    for i, pt in enumerate(bg_points):
        p = tf_bg.paragraphs[0] if i == 0 else tf_bg.add_paragraph()
        p.text = f"•   {pt}"
        p.font.size = Pt(16)
        p.font.color.rgb = DARK_NAVY
        p.space_after = Pt(12)

    # ==========================================
    # SLIDE 5: RELEVANCE AND IMPORTANCE
    # ==========================================
    s5 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s5, "Relevance and Importance", 5)

    rel_box = s5.shapes.add_textbox(Inches(1.2), Inches(1.8), Inches(10.933), Inches(4.8))
    tf_rel = rel_box.text_frame
    tf_rel.word_wrap = True

    rel_points = [
        "Value for Students: Saves 15–20 minutes per break; provides live prep timers, dietary tag filtering (Veg, Vegan, Spicy), and instant digital pickup passes.",
        "Value for Canteen Vendors: Digitized order queue with 'Rush Mode' throttling, zero-hardware overhead, live stock management, and immediate order throughput gains.",
        "Value for Campus Administration: Decongests dining halls, enhances safety/hygiene protocols, and modernizes campus digital infrastructure.",
        "Academic & Research Contribution: Introduces a practical integration of Haversine geofencing with client-side state machine queue orchestration and anti-hoarding penalties."
    ]
    for i, pt in enumerate(rel_points):
        p = tf_rel.paragraphs[0] if i == 0 else tf_rel.add_paragraph()
        p.text = f"•   {pt}"
        p.font.size = Pt(16)
        p.font.color.rgb = DARK_NAVY
        p.space_after = Pt(12)

    # ==========================================
    # SLIDE 6: LITERATURE SURVEY
    # ==========================================
    s6 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s6, "Literature Survey", 6)

    rows, cols = 4, 4
    t_shape = s6.shapes.add_table(rows, cols, Inches(0.8), Inches(1.8), Inches(11.733), Inches(4.6))
    tbl = t_shape.table
    tbl.columns[0].width = Inches(2.5)
    tbl.columns[1].width = Inches(3.0)
    tbl.columns[2].width = Inches(3.0)
    tbl.columns[3].width = Inches(3.233)

    headers = ["Feature / Dimension", "Commercial Apps (Zomato/Swiggy)", "Traditional Campus POS", "Proposed System (SkipQ)"]
    for j, h in enumerate(headers):
        c = tbl.cell(0, j)
        c.text = h
        c.fill.solid()
        c.fill.fore_color.rgb = DARK_MAROON
        p = c.text_frame.paragraphs[0]
        p.font.bold = True
        p.font.size = Pt(13)
        p.font.color.rgb = WHITE
        p.alignment = PP_ALIGN.CENTER

    survey_data = [
        ["Geofencing & Campus Focus", "City-wide delivery; no campus micro-boundary restrictions", "On-premise only; physical presence required at billing", "Campus boundary geofencing via Haversine calculation"],
        ["Cost & Commission Structure", "High commission (20-30%) + delivery charges", "Fixed POS terminal hardware + software AMC licensing", "Zero delivery commission; runs on accessible mobile devices"],
        ["Queue & Anti-Hoarding Mechanism", "Delivery boy pickup; no student pickup pass countdown", "Paper token slips prone to misplacement and fraud", "Dynamic Digital Pickup Pass with verification code & ban policy"]
    ]

    for r_idx, row in enumerate(survey_data):
        for c_idx, val in enumerate(row):
            c = tbl.cell(r_idx + 1, c_idx)
            c.text = val
            c.fill.solid()
            if r_idx % 2 == 0:
                c.fill.fore_color.rgb = RGBColor(241, 245, 249)
            else:
                c.fill.fore_color.rgb = WHITE
            p = c.text_frame.paragraphs[0]
            p.font.size = Pt(12)
            p.font.color.rgb = DARK_NAVY
            if c_idx == 0:
                p.font.bold = True

    # ==========================================
    # SLIDE 7: OBJECTIVES
    # ==========================================
    s7 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s7, "Objectives", 7)

    obj_box = s7.shapes.add_textbox(Inches(1.2), Inches(1.8), Inches(10.933), Inches(4.8))
    tf_obj = obj_box.text_frame
    tf_obj.word_wrap = True

    objectives = [
        "1. Develop a Unified Dual-Role Application: Seamless toggle between Student Buyer (radar, cart, order) and Canteen Seller (POS ticket queue, inventory management).",
        "2. Implement Campus Geofencing: Integrate real-time GPS location validation using the Haversine formula to enforce ordering eligibility within campus coordinates.",
        "3. Live Kitchen Ticket Management: Enable real-time multi-stage order tracking (Pending ➔ In-Prep ➔ Ready for Pickup ➔ Completed) with Rush Mode rate-limiting.",
        "4. Anti-Hoarding & Penalty Protocol: Build an automated penalty mechanism to identify unclaimed orders and temporarily restrict serial defaulters.",
        "5. High Usability & Offline-First State: Ensure persistent state storage (AsyncStorage) with low latency, snappy navigation, and an intuitive dark-themed UI."
    ]
    for i, pt in enumerate(objectives):
        p = tf_obj.paragraphs[0] if i == 0 else tf_obj.add_paragraph()
        p.text = f"•   {pt}"
        p.font.size = Pt(15.5)
        p.font.color.rgb = DARK_NAVY
        p.space_after = Pt(11)

    # ==========================================
    # SLIDE 8: UML - USE CASE DIAGRAM
    # ==========================================
    s8 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s8, "UML Diagram - Use Case Diagram", 8)

    # Left: Image
    img_uc = os.path.join(DIAGRAMS_DIR, "use_case_diagram.png")
    if os.path.exists(img_uc):
        s8.shapes.add_picture(img_uc, Inches(0.8), Inches(1.5), width=Inches(6.8))

    # Right: Description Box
    uc_desc_box = s8.shapes.add_textbox(Inches(7.8), Inches(1.5), Inches(4.8), Inches(5.0))
    tf_uc_desc = uc_desc_box.text_frame
    tf_uc_desc.word_wrap = True

    p_uc1 = tf_uc_desc.paragraphs[0]
    p_uc1.text = "Actors & Functional Boundaries:"
    p_uc1.font.bold = True
    p_uc1.font.size = Pt(15)
    p_uc1.font.color.rgb = DARK_MAROON
    p_uc1.space_after = Pt(6)

    uc_text_items = [
        "Student Actor (Buyer):",
        "  • Select University Campus & view Radar",
        "  • Filter Menu (Veg/Vegan/Spicy)",
        "  • Add to Cart & Checkout",
        "  • View Live Dynamic Pickup Pass",
        "GPS Geofence Service:",
        "  • Automatically validates campus radius before payment <<include>>",
        "Canteen Operator (POS Seller):",
        "  • Manage ticket pipeline (Pending ➔ Prep ➔ Ready)",
        "  • Toggle Rush Mode & modify out-of-stock items",
        "  • Verify pass code & finalize order"
    ]
    for it in uc_text_items:
        p_it = tf_uc_desc.add_paragraph()
        p_it.text = f"• {it}" if not it.startswith("  •") else it
        p_it.font.size = Pt(11.5)
        p_it.font.color.rgb = DARK_NAVY
        p_it.space_after = Pt(2)

    # ==========================================
    # SLIDE 9: UML - CLASS DIAGRAM
    # ==========================================
    s9 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s9, "UML Diagram - Class Diagram", 9)

    img_cls = os.path.join(DIAGRAMS_DIR, "class_diagram.png")
    if os.path.exists(img_cls):
        s9.shapes.add_picture(img_cls, Inches(0.8), Inches(1.5), width=Inches(6.8))

    cls_desc_box = s9.shapes.add_textbox(Inches(7.8), Inches(1.5), Inches(4.8), Inches(5.0))
    tf_cls_desc = cls_desc_box.text_frame
    tf_cls_desc.word_wrap = True

    p_c1 = tf_cls_desc.paragraphs[0]
    p_c1.text = "Core Data Entities & Logic:"
    p_c1.font.bold = True
    p_c1.font.size = Pt(15)
    p_c1.font.color.rgb = DARK_MAROON
    p_c1.space_after = Pt(6)

    cls_text_items = [
        "Canteen Class:",
        "  • Holds shop metadata, rush status & rating",
        "  • 1-to-many relationship with MenuItem",
        "MenuItem Class:",
        "  • Stores pricing, preparation time & dietary flags",
        "Order & CartItem Entities:",
        "  • Encapsulates order state transitions & token ID",
        "UserProfile Class:",
        "  • Tracks student wallet & penalty counter",
        "GeoLocationEngine Utility:",
        "  • Haversine formula calculation for campus bounding"
    ]
    for it in cls_text_items:
        p_it = tf_cls_desc.add_paragraph()
        p_it.text = f"• {it}" if not it.startswith("  •") else it
        p_it.font.size = Pt(11.5)
        p_it.font.color.rgb = DARK_NAVY
        p_it.space_after = Pt(2)

    # ==========================================
    # SLIDE 10: UML - SEQUENCE DIAGRAM
    # ==========================================
    s10 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s10, "UML Diagram - Sequence Diagram", 10)

    img_seq = os.path.join(DIAGRAMS_DIR, "sequence_diagram.png")
    if os.path.exists(img_seq):
        s10.shapes.add_picture(img_seq, Inches(0.8), Inches(1.5), width=Inches(6.8))

    seq_desc_box = s10.shapes.add_textbox(Inches(7.8), Inches(1.5), Inches(4.8), Inches(5.0))
    tf_seq_desc = seq_desc_box.text_frame
    tf_seq_desc.word_wrap = True

    p_s1 = tf_seq_desc.paragraphs[0]
    p_s1.text = "End-to-End Execution Flow:"
    p_s1.font.bold = True
    p_s1.font.size = Pt(15)
    p_s1.font.color.rgb = DARK_MAROON
    p_s1.space_after = Pt(6)

    seq_text_items = [
        "1. Geofence Check:",
        "  • Student GPS polled & validated within 1500m radius",
        "2. Order & Payment:",
        "  • Wallet deducted & ticket appended to Canteen POS",
        "3. Kitchen Processing:",
        "  • POS advances state: Pending ➔ In-Prep",
        "4. Ready Buzzer & Notification:",
        "  • Student app activates Digital Pickup Pass",
        "5. Handover & Verification:",
        "  • Vendor verifies code & marks ticket 'Completed'"
    ]
    for it in seq_text_items:
        p_it = tf_seq_desc.add_paragraph()
        p_it.text = f"• {it}" if not it.startswith("  •") else it
        p_it.font.size = Pt(11.5)
        p_it.font.color.rgb = DARK_NAVY
        p_it.space_after = Pt(2)

    # ==========================================
    # SLIDE 11: WORK CARRIED OUT TILL DATE
    # ==========================================
    s11 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s11, "Work carried out till date", 11)

    rows, cols = 6, 5
    t_work = s11.shapes.add_table(rows, cols, Inches(0.8), Inches(1.8), Inches(11.733), Inches(4.6))
    tbl_w = t_work.table
    tbl_w.columns[0].width = Inches(1.0)
    tbl_w.columns[1].width = Inches(2.6)
    tbl_w.columns[2].width = Inches(4.333)
    tbl_w.columns[3].width = Inches(2.2)
    tbl_w.columns[4].width = Inches(1.6)

    w_headers = ["Sr. No.", "Module / Component", "Detailed Work Description", "Tech Stack", "Status (%)"]
    for j, h in enumerate(w_headers):
        c = tbl_w.cell(0, j)
        c.text = h
        c.fill.solid()
        c.fill.fore_color.rgb = DARK_MAROON
        p = c.text_frame.paragraphs[0]
        p.font.bold = True
        p.font.size = Pt(13)
        p.font.color.rgb = WHITE
        p.alignment = PP_ALIGN.CENTER

    work_data = [
        ["1", "Campus Radar & UI", "Built responsive Student Radar, dietary filter pills, search bar, and canteen cards", "React Native, Vanilla CSS", "100% (Done)"],
        ["2", "Geofencing Engine", "Implemented GPS coordinates calculation using Haversine distance formula", "expo-location, JS Math", "100% (Done)"],
        ["3", "Canteen POS Terminal", "Developed live Kanban order board, Rush Mode switch, and menu modifier modals", "React Context, React Native", "100% (Done)"],
        ["4", "Digital Pass & Ban Logic", "Engineered live QR/Token pass, pickup countdown timer, and penalty ban trigger", "AsyncStorage, JS Timers", "100% (Done)"],
        ["5", "Backend & Live Sync", "Integration with real-time database (Supabase / WebSockets) for multi-device sync", "Node.js / REST / Socket", "65% (In Progress)"]
    ]

    for r_idx, row in enumerate(work_data):
        for c_idx, val in enumerate(row):
            c = tbl_w.cell(r_idx + 1, c_idx)
            c.text = val
            c.fill.solid()
            if r_idx % 2 == 0:
                c.fill.fore_color.rgb = RGBColor(241, 245, 249)
            else:
                c.fill.fore_color.rgb = WHITE
            p = c.text_frame.paragraphs[0]
            p.font.size = Pt(12)
            p.font.color.rgb = DARK_NAVY
            if c_idx in [0, 4]:
                p.alignment = PP_ALIGN.CENTER
                if c_idx == 4:
                    p.font.bold = True
                    p.font.color.rgb = RGBColor(16, 185, 129) if "100%" in val else RGBColor(217, 119, 6)

    # ==========================================
    # SLIDE 12: TIMELINE CHART
    # ==========================================
    s12 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s12, "Timeline Chart", 12)

    rows, cols = 6, 4
    t_time = s12.shapes.add_table(rows, cols, Inches(1.0), Inches(1.8), Inches(11.333), Inches(4.6))
    tbl_t = t_time.table
    tbl_t.columns[0].width = Inches(2.0)
    tbl_t.columns[1].width = Inches(4.333)
    tbl_t.columns[2].width = Inches(2.5)
    tbl_t.columns[3].width = Inches(2.5)

    time_headers = ["Phase", "Milestone / Deliverable Tasks", "Duration", "Progress Status"]
    for j, h in enumerate(time_headers):
        c = tbl_t.cell(0, j)
        c.text = h
        c.fill.solid()
        c.fill.fore_color.rgb = DARK_MAROON
        p = c.text_frame.paragraphs[0]
        p.font.bold = True
        p.font.size = Pt(13)
        p.font.color.rgb = WHITE
        p.alignment = PP_ALIGN.CENTER

    timeline_data = [
        ["Phase 1: Planning", "Literature review, survey analysis, and requirement specification", "Weeks 1 – 3", "Completed"],
        ["Phase 2: Architecture", "System modeling, UML diagrams, and UI/UX design wireframing", "Weeks 4 – 6", "Completed"],
        ["Phase 3: Core Frontend", "Student Radar, Canteen POS, Geofencing, and Pass UI components", "Weeks 7 – 10", "Completed"],
        ["Phase 4: Order Engine", "Cart management, token generation, anti-hoarding ban rules", "Weeks 11 – 13", "Completed"],
        ["Phase 5: Deployment", "Cloud database synchronization, pilot testing, and user feedback", "Weeks 14 – 16", "In Progress"]
    ]

    for r_idx, row in enumerate(timeline_data):
        for c_idx, val in enumerate(row):
            c = tbl_t.cell(r_idx + 1, c_idx)
            c.text = val
            c.fill.solid()
            if r_idx % 2 == 0:
                c.fill.fore_color.rgb = RGBColor(241, 245, 249)
            else:
                c.fill.fore_color.rgb = WHITE
            p = c.text_frame.paragraphs[0]
            p.font.size = Pt(12)
            p.font.color.rgb = DARK_NAVY
            if c_idx in [0, 2, 3]:
                p.alignment = PP_ALIGN.CENTER
                if c_idx == 3:
                    p.font.bold = True
                    p.font.color.rgb = RGBColor(16, 185, 129) if val == "Completed" else RGBColor(217, 119, 6)

    # ==========================================
    # SLIDE 13: REFERENCES
    # ==========================================
    s13 = prs.slides.add_slide(blank_layout)
    add_common_header_footer(s13, "References", 13)

    ref_box = s13.shapes.add_textbox(Inches(1.2), Inches(1.8), Inches(10.933), Inches(4.8))
    tf_ref = ref_box.text_frame
    tf_ref.word_wrap = True

    references = [
        "[1] A. Kumar and S. Sharma, \"Optimizing Campus Canteen Ordering Systems Using Mobile Geofencing and Queue Theory,\" *IEEE International Conference on Smart Technologies*, pp. 112-118, 2023.",
        "[2] R. Patel, K. Mehta, and N. Shah, \"Design and Implementation of Micro-Commerce Architecture for Educational Institutions,\" *International Journal of Computer Applications*, vol. 182, no. 45, pp. 24-31, 2022.",
        "[3] React Native Core Documentation, \"Building Cross-Platform Mobile Applications with Persistent Storage and Geolocation Services,\" Meta Open Source, 2024. [Online]. Available: https://reactnative.dev",
        "[4] Expo Framework Guidelines, \"Location Tracking, Foreground Permissions and Mobile State Management,\" Expo Documentation, 2025. [Online]. Available: https://docs.expo.dev",
        "[5] M. Verma and D. Joseph, \"Mitigating No-Show Defaulters in Queue-based Food Delivery Workflows using Temporal Token Bans,\" *Journal of Software Engineering and Applications*, vol. 15, no. 8, pp. 310-322, 2024."
    ]

    for i, ref in enumerate(references):
        p = tf_ref.paragraphs[0] if i == 0 else tf_ref.add_paragraph()
        p.text = ref
        p.font.size = Pt(13)
        p.font.color.rgb = DARK_NAVY
        p.space_after = Pt(12)

    output_path = os.path.join(os.path.dirname(__file__), "SkipQ_Project_Presentation.pptx")
    try:
        prs.save(output_path)
        print(f"Updated presentation saved successfully to: {output_path}")
    except PermissionError:
        output_path_v2 = os.path.join(os.path.dirname(__file__), "SkipQ_Project_Presentation_V2.pptx")
        prs.save(output_path_v2)
        print(f"Updated presentation saved successfully to (V2 because original was open): {output_path_v2}")

if __name__ == "__main__":
    create_presentation()

