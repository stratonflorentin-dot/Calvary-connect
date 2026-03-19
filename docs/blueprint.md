# **App Name**: Calvary Connect

## Core Features:

- Driver Login & Dashboard: Secure login for drivers and a personalized dashboard displaying assigned shipments, current tasks, and schedules.
- Shipment Overview (Dispatcher): A centralized interface for dispatchers to view all active and pending shipments, their current statuses, and assigned drivers.
- Shipment Status Updates: Allow drivers to easily update the status of their assigned shipments (e.g., 'En Route', 'Arrived', 'Unloading', 'Delivered').
- Basic Shipment Tracking: Provide a simple, read-only interface for customers or internal staff to check the latest status of a specific shipment using a tracking number.
- Internal Messaging: A simple messaging system for direct communication between dispatchers and drivers regarding specific shipments or tasks.
- AI Insights Tool: An AI tool for CEO users that analyzes fleet data to generate key highlights, areas of concern, and actionable recommendations using real-time information.
- CEO Dashboard Stat Cards: Real-time statistical cards for CEO dashboard displaying Total Trucks, Active Trips, Total Revenue, Pending Expenses, Drivers Online, and Low Stock Items using Firestore queries.
- Fleet Overview (CEO): Real-time table view of the entire fleet with details like name, type, plate, condition, and status (Available, In Use, Maintenance) with onSnapshot listener.
- Active Trips Display (CEO): Real-time display of active trips showing Trip ID, Driver, Route, Truck, Status, and Start time.
- Revenue and Fuel Charts (CEO): Bar chart for monthly income vs expenses and a line chart for fuel consumption over time.
- CEO Actions: Perform administrative actions such as adding/editing/deactivating users, adding/removing fleet vehicles, adding new trips, approving expenses, and approving parts requests, all persisting to Firestore.
- Trip Management (Operations): Operations Manager can create new trips, assign drivers and available trucks, and update trip statuses with real-time notifications.
- Inventory & Parts Requests (Operations): Manage inventory items, log usage per trip, and approve/reject spare parts requests from mechanics.
- Mandatory Driver Location Tracking: A mandatory location gate for drivers, requiring GPS permission and continuously updating their live position to Firebase Realtime Database and Firestore, with an 'offline' alert for dispatch.
- Driver Trip Interface: Mobile-only interface for drivers to view assigned trips, mark statuses (Loaded, Start Trip, Delivered), and view trip details on an interactive map.
- Delivery Proof Upload (Driver): Drivers can capture and upload photos as proof of delivery to Firebase Storage, linking them to specific trips and updating trip status.
- Driver Reporting (Fuel/Breakdown): Drivers can submit fuel requests and report vehicle breakdowns via a mobile interface, triggering appropriate notifications to management and mechanics.
- Service Request Management (Mechanic): Mechanics can view, start, log service details (including parts used from inventory), update truck conditions, schedule next services, and mark maintenance requests as complete.
- Spare Parts Request (Mechanic): Mechanics can view inventory, request spare parts with urgency levels and reasons, and track the status of their requests.
- Accountant Expense Management: Accountants can add, view, edit, and delete expenses, categorize them, link them to trips, and export expense data to Excel.
- Accountant Income Management: Accountants can add, view, edit, and delete income records, link them to trips, specify payment methods, and export income data to Excel.
- Fuel Approvals (Accountant): Accountants can view and approve or reject pending fuel requests from drivers, automatically creating expense records upon approval.
- Monthly Financial Reports (Accountant): Generate comprehensive monthly reports including income, expenses, net profit, and allowances, with summary cards, charts, and a detailed Excel export option.
- Shared Inventory Management System: A cross-role inventory system providing real-time item status (In Stock, Low Stock, Out of Stock), with different permissions for CEO (view/approve), Operations (view/log/approve), and Mechanic (view/log/request).
- Real-time Notification System: A centralized notification system delivering real-time alerts (bell, toast, critical modals) for various events like parts requests, trip updates, low stock, breakdowns, and driver offline status.
- Interactive Live Map: A Mapbox-based live map displaying real-time driver positions with rotating truck markers, route displays, and driver information popups, accessible to CEO, Operations, and Mechanic roles.

## Style Guidelines:

- Primary color: A deep, professional blue-grey (#2952A3) for headers, buttons, and key interactive elements.
- Background color: A very light, almost off-white with a subtle blue-grey tint (#F0F1F5) for high readability.
- Accent color: A vibrant yet clean aqua-blue (#52CAE0) for notifications, alerts, and active states.
- Status badges will use specific colors: green for success, amber for warning, red for danger, blue for information, and gray for neutral.
- Mobile stat cards will feature unique gradient backgrounds like linear-gradient(135deg, #1a1a2e, #16213e) for 'Total Trucks'.
- All text uses 'Inter', a grotesque-style sans-serif font, for its modern, objective, and highly legible appearance.
- Specific elements like 'Location Required' title and 'FleetCommand' launch screen text will use 'Syne 800'.
- Stat card labels will use 'DM Sans 400', and status badges will use 'DM Sans 500'.
- Utilize a consistent set of crisp, clear Lucide line-art icons (20px, stroke-width 1.5) that are universally recognized for logistical functions and system actions.
- Custom SVG truck icons will be used for map markers, in amber (#F59E0B) with a white outline, rotating to match heading.
- Desktop layout features a 240px fixed sidebar and fluid main content with 24px padding, transitioning to a 40px icon-only sidebar at smaller desktop widths.
- Mobile layout adopts an Instagram-style bottom tab navigation (60px height + safe-area-inset-bottom), full-width feed cards, and bottom sheets instead of centered modals.
- Emphasize clean, structured layouts with clear information hierarchy, utilizing cards and distinct sections to segment data for scannability across various screen sizes.
- Incorporate subtle and functional animations, such as smooth transitions between views, state changes, and progress indicators, to provide clear feedback without distracting the user.
- Key animations include CSS pulse for 'in_transit' status, spring scale on mobile tab taps, max-height animation for inline card expansion, and slide-in/out for mobile swipe actions.
- AI insights response will use a typewriter reveal animation, map markers will have 300ms CSS ease transitions, and desktop cards will have translateY(-2px) and shadow up on hover.
- Loading states will use skeleton screens with shimmer effects, the notification bell will bounce on new notifications, and toast messages will slide in from the bottom.
- Haptic visual feedback will be provided for button presses (scale 0.95), success actions (green ripple), delete actions (card slide), and errors (shake animation).