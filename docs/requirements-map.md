# Requirements map — Discovery School Burundi website

Every requirement from the Headmaster's brief (and the two technical requirements from the project owner), traced to the page and section where it is met. Status: **Met** = built; **Needs input** = built, school supplies/confirms content; **Pending** = placeholder only.

Prepared 14 September 2026. Sections are referenced as `file.html#anchor`.

## Technical (project owner)

| Requirement | Where on the site | Status | Notes |
|---|---|---|---|
| As lightweight as possible; no database or transactions — _it is not transactional (no database, etc.)_ | Whole site — plain HTML/CSS with 130 lines of JavaScript, built by `build.py`. Photos resized to four widths, WebP with one JPEG fallback, metadata stripped. | Met | Home page ≈1.1 MB with all 11 photos at retina resolution (was 8.2 MB). No server code, no accounts, no cookies. |
| Responsive — optimised for phone, tablet and laptop | Whole site — `site.css` breakpoints at 560 / 800 / 860 / 960 px; tested at 375, 768 and 1200 px. | Met | Fee tables scroll sideways inside their box on phones with the row label pinned; the photo strip swipes. |

## Overview

| Requirement | Where on the site | Status | Notes |
|---|---|---|---|
| Inviting, warm, modern | Whole site — Fraunces + Nunito typefaces, cream/sand ground, rounded cards, colour photography without dark overlays. | Met | All text/background colour pairs pass WCAG AA. |
| Current students & parents: pictures, calendar, link to classroom.google.com | • Families → `families.html#calendar`, `#schedules` • Google Classroom: home "Everyday essentials" card, Families hub, footer • Student Life → `student-life.html#gallery` (20 photos + lightbox); home photo strip | Needs input | Calendar shows the last published term (2025–26 T1); replace each term. |
| Prospective students & parents: admission, curriculum, tuition | • Admissions & Fees → `admissions.html#steps`, `#requirements`, `#fees`, `#payment`, `#faq` • Academics → `academics.html` (whole page) | Met | Fees transcribed from the 2025–26 sheets; update yearly. |
| Information for donors who want to help | Partner → `partner.html` — impact, pray, give (current needs + CMML link), build, visit & volunteer. | Met |  |
| Location: Burundi, Africa | Top bar, footer, Contact page, About → `about.html#facts`. Address, phone, email and a Google Maps link. | Met |  |
| Vision: "Rooted in Christ. Ready for Tomorrow." | Home hero headline; About → `#mission`; footer; inside the values tree. | Met |  |
| Mission: "Planting seeds for Burundi's future…" | Home hero lead; About → `#mission` with the school's three objectives. | Met |  |
| Core values — citizenship, discipline, excellence, ingenuity, integrity, wisdom — with the coloured tree | Home → "Character with deep roots" (interactive tree + list); About → `#values` (tree + caption + six cards). | Met | Tree redrawn in the original artwork's colours; hover/tap a value to highlight it. Swap in the original file if the school supplies it. |
| School verse Job 37:14b; an annual theme can be featured | Home hero (verse line); About → `#mission` card: school verse + a slot for this year's theme. | Needs input | Annual theme text is a marked placeholder. |
| Emphasise outcomes: trilingual (French, Kirundi, English) critical thinkers with a Biblical worldview | Home → "What a Discovery graduate carries into the world"; Academics → `#english`, `#outcomes` (IOWA, SAT, Diplôme d'État equivalence, alumni destinations). | Met |  |
| Preserve all information from the current website | Leadership bios, staff, quick facts, academics by level, library, technology, athletics, fine arts, spiritual life, clubs, field trips, student government, schedules, lunch, handbook, WhatsApp groups, test-prep links, fees & payment codes, current needs, building projects, volunteering, giving, social links, scripture. | Needs input | Three documents must be copied over: student handbook PDF, lunch/boarding menus, volunteer travel info. |
| Keep statistics general so the site rarely needs updating | "90+ teachers", "150+ staff", "9,000+ books", "several graduating classes", alumni "across Africa, Europe, Asia and North America". | Met | No enrolment numbers or year-specific counts on the site. |

## Design philosophy, identity and vision

| Requirement | Where on the site | Status | Notes |
|---|---|---|---|
| Easy to navigate | One 8-item menu on every page; three audience cards under the home hero; pill sub-navigation at the top of each inner page; footer links by audience. | Met |  |
| Truly Burundian and international | Home → "A truly Burundian school, with an international standard of learning"; About → `#identity` (four pillars); Academics → `#english` (Kirundi first, English immersion, American-style curriculum). | Met |  |
| Affordability — quality unavailable elsewhere in Bujumbura at this price — _its unmatched value proposition_ | Home → "An education of this quality, at a price Bujumbura families can afford"; Admissions → `#why`; About → `#identity` "Affordable, on purpose"; Partner → `#impact`. | Met | Stated four times, then backed by the published fee tables. |
| Christian heart of love for students | About → `#identity` "A Christian heart"; Student Life → `#spiritual` (chaplain prays with each student); Partner → `#impact`. | Met |  |
| Dedication to developing Christian character | Values tree and six value cards; Student Life → `#spiritual` (daily Bible, chapel, Bible club, evangelism team). | Met |  |
| Colourful images of students doing hands-on activities | Science lab (home hero), library, cutting, sewing, art, VR, computer labs, basketball, football — across pages and in the gallery. | Met | 26 photos in use. Some from the old site are small (≈700 px); originals from the school would let them go larger. |
| Highlight the trees on campus and the main high-school building | Home → assembly under the mango tree; About hero → the main secondary building with Lake Tanganyika behind; gallery. | Met |  |
| School logo prominent | Header of every page; footer (on a white plate). | Needs input | Current logo is recovered from a 960 px JPEG; an SVG or large transparent PNG from the school will be crisper. |
| NAPS accreditation seal prominent | Home hero badge; About → `#accreditation` (full-size seal with explanation); footer of every page. | Met |  |
| Vision statement prominent | Home hero headline, first thing on the page. | Met |  |
| Colours from the logo — primarily blue and orange | `site.css` tokens: logo blue #0099c2 and orange #f58220 for fills; darker tints for text so every pair is readable. | Met |  |
| Structure reflects the vision and the mission — Burundian identity with an international curriculum | The values tree's roots ("Rooted in Christ") and canopy ("Ready for Tomorrow"); Academics ordered Kirundi → French → English → Swahili; About → `#identity`. | Met |  |
| Vibrant, alive, high-quality imagery | Photo strip on the home page; 20-photo gallery with lightbox; photos on every page but Contact and Staff. | Met |  |

## Structure, audience navigation and key features

| Requirement | Where on the site | Status | Notes |
|---|---|---|---|
| Clean architecture; three core audiences with their own pathways or menus | Home → "Find your path": Current students & parents / Prospective families / Prayer supporters & donors, each with four direct links; menu items Families, Admissions & Fees, Partner. | Met |  |
| Current families: campus pictures | Student Life → `#gallery`; home photo strip; Instagram/Facebook links. | Met |  |
| Current families: dynamic school calendar | Families → `#calendar` — dated table of term start, parent meetings, holidays, exams, reports, celebrations. | Needs input | Static table by design (no database). The school updates it each term; a Google Calendar embed is an option if they prefer. |
| Current families: direct links to Google Classroom | Home audience card, Families hub card, footer, Staff page. | Met |  |
| Prospective families: curriculum description | Academics → `#programmes` (nursery/preschool, primary, secondary), `#library`, `#support`. | Met |  |
| Prospective families: English immersion | Academics → `#english`; Admissions → `#why`; FAQ "My child does not speak English yet". | Met |  |
| Prospective families: multiple modalities — auditory, visual, tactile, kinesthetic | Academics → `#styles` "See it, hear it, touch it, do it" — four cards plus art and VR photos. | Met |  |
| Prospective families: tuition fee information | Admissions → `#fees` — tuition, tests, lunch, annual items and totals for every grade; bus fees for 28 areas; discounts; `#payment` with bank, EcoCash and Lumicash steps. | Needs input | 2025–26 figures; the school confirms account numbers (the old site's text and fee sheet differed) and updates yearly. |
| Prospective families: clear step-by-step admissions process | Admissions → `#steps` (visit, documents, placement test, enrol) and `#requirements`. | Met |  |
| Staff: password-protected page (one shared password) with staff-event photos, teaching resources and a Google Classroom link | `staff.html` — placeholder page with a Google Classroom link. | Pending | Requirements still being gathered. Note: one shared password on a static site is a client-side check — fine for photos and worksheets, not for anything sensitive. |
| Prospective staff: job board with openings and employment exam dates | Careers → `#jobs` (board with status), `#exam` (how recruitment works: notice, file, written test, oral test, interview), `#requirements`, `#benefits`. | Needs input | Board reflects the closed 2026–27 round; update when the next notice is issued. |
| Prayer supporters / ministry partners / donors: long-term impact and how to partner | Partner → `#impact` (why a school, why this one), `#pray`, `#give` (current needs, CMML, designated gifts), `#build`, `#visit` (short- and long-term volunteering). | Met |  |

## What the school still needs to supply

1. This year's theme — About page, next to the school verse.
2. Current term calendar — Families page.
3. Student handbook PDF and lunch / boarding menus — Families page.
4. Volunteer travel information — Partner page.
5. Next recruitment notice — Careers page (job board and dates).
6. Confirm fee-payment account numbers — Admissions page.
7. Contact form — a free Formspree ID so messages reach info@discoveryschoolburundi.org.
8. Original logo and values-tree artwork (SVG or large PNG).
9. Staff page requirements — what goes there and who maintains it.
