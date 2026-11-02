Build a high-performance, lightweight expense tracker web app. This will later be shipped as Android and iOS apps via Capacitor or a similar bridge, so every architectural and performance decision must optimize for that cross-platform future.

---

## CORE PHILOSOPHY

Performance and feel are the #1 priority. The app must feel instantaneous — zero jank, zero lag, zero layout shift. Every interaction must feel tactile and alive. Treat this like a native app, not a website.

- All UI updates must be synchronous and optimistic (update the UI first, persist in the background)
- No loading spinners for local operations
- Touch targets: minimum 44×44px on all interactive elements
- Use CSS `will-change`, `transform`, and `opacity` for all animations (never `width`, `height`, `margin`, `top`, etc.)
- Use `pointer-events` and `touch-action` correctly to avoid tap delays
- Add `touch-action: manipulation` to all buttons to eliminate 300ms tap delay
- Prefer CSS transitions over JS animations wherever possible
- Use `requestAnimationFrame` for any JS-driven animations

---

## TECH STACK

- **Framework**: Vanilla JS with no heavy framework (or Preact if a framework is truly needed — bundle must stay under 50KB gzipped total)
- **Styling**: Pure CSS with CSS custom properties for theming; no Tailwind, no CSS-in-JS
- **Storage**: IndexedDB (via a thin wrapper like idb) for all data; localStorage only for settings/preferences
- **Build**: Vite for bundling; enable code splitting, tree shaking, and minification
- **No jQuery, no Lodash, no moment.js** — use native APIs

---

## MICROINTERACTIONS & FEEL (Highest Priority)

Every single interactive element must have:

1. **Buttons**: 
   - On `pointerdown`: immediate scale(0.95) + slight brightness reduction (CSS: `filter: brightness(0.9)`)
   - On `pointerup`/`pointercancel`: spring back with `cubic-bezier(0.34, 1.56, 0.64, 1)` (overshoot spring)
   - Transition: `transform 80ms ease-out` for press, `transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)` for release
   - Ripple effect on tap: a circular radial gradient expanding from tap point, fading out in 400ms

2. **List items**: Slide in from bottom on add (staggered if multiple), slide+fade out on delete
3. **Number input**: Animate the amount display as digits are typed (flip or slide transition per digit)
4. **Category selection**: Chips/pills with a satisfying pop (scale 1→1.08→1) when selected
5. **Bottom sheet / modal**: Slide up from bottom with spring physics; backdrop fades in; drag-to-dismiss with momentum
6. **Toggle (Debit/Credit)**: Smooth sliding pill animation, color shift (red for debit, green for credit)
7. **Analytics charts**: Bars/segments animate in on mount and on data change (height/arc transition)
8. **Success feedback**: Subtle checkmark animation + brief color flash when expense is saved
9. **Page transitions**: Slide left/right between main views (not fade — slide feels more native)
10. **Number formatting**: Format amounts live as user types (e.g., "1000" → "1,000")

---

## APP STRUCTURE

Single-page app with three main views navigated via a bottom tab bar:

### Tab 1 — ADD EXPENSE (Default/Home Tab)

Layout (bottom sheet style, always visible):

[ Amount Display: large, centered, monospaced font ]
[ Debit | Credit toggle — pill slider, Debit default ]

[ Category row: horizontal scrollable chips ]
Icons + labels: Food, Transport, Shopping, Bills, Health, Entertainment, Other

“New Category” chip at end

[ Note field: single line, placeholder “Item name / note (optional)” ]

[ ADD button: full width, prominent, with ripple + spring animation ]


- Amount input: Use a custom numeric keypad (not native keyboard on mobile) for consistent cross-platform feel. Large keys, satisfying press feedback.
- Amount display: Shows "0" by default, updates live. Support decimal input.
- Category must be selected to enable ADD button (show subtle shake animation if ADD is tapped without category)
- On successful add: button flashes green + checkmark for 600ms, then resets all fields except category (keep last used category selected)

### Tab 2 — TRANSACTIONS

Layout:

[ Month/Year selector — swipe left/right or arrow navigation ]
[ Summary bar: Total Debited | Total Credited | Net ]

[ Category sections — collapsible ]
Each category:
├── Header: [Category icon] [Name] [Total for category] [chevron]
└── Expanded: grouped by item name (from note field)
├── Item Group: “Coffee” (3 entries) → [total] [expand arrow]
│ └── Individual entries: date + amount + debit/credit badge
└── Unnamed entries listed individually


- Default: current month, all categories expanded
- Swipe left on any item to reveal delete action (with confirmation)
- Category headers are sticky while scrolling within that category
- Smooth collapse/expand animation for category sections and item groups
- Pull-to-refresh gesture (even though it's local data — show a satisfying animation)

### Tab 3 — ANALYTICS

Layout:

[ Month selector ]
[ Donut/Ring chart — category breakdown, animated on load ]
[ Category list with progress bars showing % of total spend ]
[ Budget section ]
Per category:
├── [Category] [Spent: X / Budget: Y]
├── Progress bar (color: green→yellow→red as % increases)
└── “Over budget” warning badge if exceeded
[ Monthly trend: horizontal bar chart — last 6 months ]


- Tap a category in the chart → highlight that slice + scroll to that category's bar
- Budget setting: tap any category budget → inline edit with animated transition
- Charts must be drawn with Canvas 2D or SVG — no charting libraries

---

## DATA MODEL

```js
// Expense
{
  id: string,           // crypto.randomUUID()
  amount: number,       // in smallest currency unit (paise/cents) to avoid float issues
  type: 'debit' | 'credit',
  categoryId: string,
  note: string,         // item name — used for grouping
  date: number,         // Date.now() timestamp
  createdAt: number
}

// Category
{
  id: string,
  name: string,
  icon: string,         // emoji or icon identifier
  color: string,        // hex color
  budget: number | null, // monthly budget in smallest unit, null = no budget
  order: number         // for sorting
}
```

Default categories (seeded on first launch): Food 🍔, Transport 🚗, Shopping 🛍️, Bills ⚡, Health 💊, Entertainment 🎬, Other 📦

---

## PERFORMANCE REQUIREMENTS

- **First Contentful Paint**: < 1s on mid-range Android (CPU throttle 4x)
- **Time to Interactive**: < 1.5s
- **Input latency**: < 16ms (one frame) from tap to visual feedback
- **No layout recalculation during animations** — compositor-only transforms only
- **Virtual scrolling** for transaction lists exceeding 100 items
- **Debounce** IndexedDB writes — batch writes every 300ms max, never on every keystroke
- **Service Worker** for offline-first (all features must work with zero network)
- Use `content-visibility: auto` on off-screen list sections
- Avoid `box-shadow` animations — use `filter: drop-shadow` or pseudo-element tricks instead

---

## VISUAL DESIGN

- **Color scheme**: Dark mode by default (OLED-friendly near-black `#0a0a0a` background), with clean light mode option
- **Typography**: System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`) — no Google Fonts to avoid network dependency
- **Spacing**: 8px base grid
- **Border radius**: 16px for cards, 24px for bottom sheets, 50% for chips/pills
- **Debit color**: `#FF4444` (red)
- **Credit color**: `#00C853` (green)
- **Accent**: `#6C63FF` (purple) for primary actions
- **Bottom tab bar**: frosted glass effect (`backdrop-filter: blur(20px)`) with subtle border-top
- **Safe area insets**: Handle `env(safe-area-inset-*)` for iOS notch/home indicator

---

## RESPONSIVE LAYOUT

- Mobile-first: designed for 375px–430px width (primary target)
- Max content width: 480px, centered on larger screens
- Bottom sheet / modal approach for all secondary actions (not separate pages)
- Keyboard avoidance: when the numeric keypad is open, content above scrolls/shifts correctly

---

## FILE STRUCTURE

src/
main.js — app entry, router, service worker registration
db.js — IndexedDB wrapper (idb library)
store.js — in-memory reactive state (simple pub/sub, no Redux)
components/
AddExpense.js
TransactionList.js
Analytics.js
CategoryChip.js
NumericKeypad.js
BottomSheet.js
TabBar.js
Chart.js — canvas-based ring + bar charts
styles/
base.css — reset, custom properties, typography
animations.css — all keyframes and transition utilities
components.css — component styles
utils/
format.js — currency formatting, date formatting
haptics.js — Vibration API wrapper for tactile feedback


---

## HAPTIC FEEDBACK

Use the Vibration API for tactile feedback on supported devices:
- Button press: `navigator.vibrate(5)` — barely perceptible, just a tap confirmation
- Successful add: `navigator.vibrate([10, 30, 10])` — double pulse
- Delete: `navigator.vibrate(20)` — single short buzz
- Error/shake: `navigator.vibrate([5, 50, 5, 50, 5])` — warning pattern
Wrap all vibration calls in feature detection; fail silently if unsupported.

---

## CAPACITOR READINESS (for future Android/iOS shipping)

- Use only Web APIs that Capacitor supports or polyfills
- Avoid `alert()`, `confirm()`, `prompt()` — use custom modal UI instead
- All assets must be relative paths (no absolute `/` paths that break in Capacitor's file:// scheme)
- CSS safe area insets must be applied from day one
- The numeric keypad must be custom (suppresses native keyboard which behaves differently per platform)
- No `window.open()` — use in-app navigation only

---

## WHAT TO BUILD FIRST

1. Vite project setup with the folder structure above
2. IndexedDB layer + default category seeding
3. Reactive store (pub/sub)
4. Tab bar + view routing with slide transitions
5. Add Expense view with custom keypad + all microinteractions
6. Transaction list with grouping logic
7. Analytics view with canvas charts
8. Budget setting flow
9. Service worker for offline support
10. Polish pass: audit every interaction for latency and feel

Start building now. Do not ask clarifying questions — make opinionated decisions and implement. The goal is a working, polished app.
