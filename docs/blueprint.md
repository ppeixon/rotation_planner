# **App Name**: RotationVista

## Core Features:

- Secure User Authentication: Implements Firebase Authentication with a 'single-user' mode, supporting Google Login (preferred) or Email/Password, ensuring only authorized access to personal rotation data.
- Interactive Calendar Views: Provides annual (12 mini-calendars) and monthly views of rotations, travel, and vacations, clearly color-coded (Orange for Rotation, Green for Travel, Blue for Vacation, Gray for Normal days) with navigation controls.
- Day Event Management: Allows users to click on any day to assign a type (Rotation, Travel, Vacation, Normal), add free-form notes, and specify flight details (ticket purchased status, flight info) through a modal editor.
- Automated 28-Day Rotation Generator: A rule-based system that generates recurrent 28-day rotation blocks from a user-defined start date and range, prioritizing manual travel or vacation entries over generated rotations.
- Real-time Cloud Synchronization: Utilizes Cloud Firestore for immediate persistence of all user data (day events, settings) across devices, ensuring real-time updates and accessibility from any location.
- Configurable User Settings: A dedicated section for users to manage personal settings, including the start date and generation range for rotations, along with user account details if authentication is enabled.
- Responsive UI & Navigation: An adaptive interface that provides an optimal experience on both mobile and desktop devices, featuring intuitive navigation for calendar views, settings, and quick actions.

## Style Guidelines:

- Primary brand color: A warm, earthy terracotta shade (#D18C47) to evoke a sense of travel and planning, avoiding literal interpretations of desert.
- Background color: A very light, subtle creamy off-white (#F5F3EF) for a clean, non-distracting canvas.
- Accent color: A deep, rich raspberry red (#CA2F57) for high-contrast interactive elements and call-to-actions, providing a modern pop.
- Day Type: Rotation days are clearly marked with NARANJA (#FF8C00).
- Day Type: Travel days are distinctly colored VERDE (#3CB371).
- Day Type: Vacation days use AZUL (#1E90FF) for clear identification.
- Day Type: Normal days use a neutral GRIS (#A9A9A9) to blend into the background.
- Body and headline font: 'Inter' (sans-serif) for its modern, highly readable, and versatile design across all UI elements and text lengths, contributing to a clean and practical feel.
- Utilize a consistent set of clean, line-based icons for calendar actions, navigation, and indicators (e.g., small indicators for notes or purchased tickets).
- Calendar layouts will feature sufficiently large cells to ensure touch-friendliness on mobile and clear information display on desktop. Overall layout will be adaptive and prioritize content readability.
- Subtle and functional animations, such as smooth transitions for month/year changes in the calendar and modal dialog appearances, to enhance user interaction without distraction.