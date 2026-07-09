# Ma’Maria Cafe & Catering — Web Application

Ma’Maria is a production-oriented MVP web application for a cafe/catering business.  
It supports daily menu publishing, online pickup orders, customer phone verification, admin order management, news posts, and Telegram menu sharing.

The application is built for a real restaurant workflow where customers can browse the daily menu, place orders, choose a pickup location and time, and track the order status.

---

## Main Features

### Customer Website

The customer side is designed as a mobile-first web interface.

Customers can:

- View the daily menu
- Browse permanent items available every day
- Create an account using their phone number
- Verify their phone number through SMS OTP
- Place pickup orders
- Select a pickup location
- Manually choose a pickup time
- Add comments to the order
- Track the status of their order
- See cancellation reasons if an order is cancelled by the admin
- Read news and announcements

The customer interface is focused on simplicity, speed, and phone usability.

---

## Admin Panel

The admin panel is available under the management area of the application.

Admins can:

- Upload and publish the daily menu
- Manage daily menu products
- Manage permanent products
- Enable or disable ordering
- View incoming orders
- Hear a notification sound when a new order arrives
- Change order statuses
- Cancel orders with a visible reason for the customer
- Manage users
- Manage website settings
- Create and manage news posts
- Generate branded menu images and PDFs from Excel files
- Post generated menus directly to a Telegram channel

The admin panel is intended for desktop usage and daily operational management.

---

## Ordering Flow

The customer ordering flow is:

1. Customer opens the website
2. Customer views the menu
3. Customer logs in or creates an account
4. Customer verifies phone number
5. Customer selects menu items
6. Customer chooses pickup location and pickup time
7. Customer submits the order
8. Admin receives the order
9. Customer sees order status updates

Orders support statuses such as:

- Pending
- Confirmed
- Preparing
- Ready
- Completed
- Cancelled

If an order is cancelled, the admin can provide a reason that is shown to the customer.

---

## Menu Management

The app supports two types of menu items:

### Daily Menu

These items change from day to day and are uploaded or edited by the admin.

### Permanent Products

These are stable items available across multiple days, such as drinks, bread, sauces, or other recurring products.

Admins can manage both daily and permanent items from the admin panel.

---

## Excel Menu Upload

The admin can upload an Excel menu file.

The app can parse menu files that include:

- Date
- Weekday
- Product number
- Product name
- Weight / grams
- Price
- Category rows

After upload, the menu can be reviewed and published for customers.

---

## Menu Image and PDF Generation

The app can generate a branded menu image and PDF from an Excel file.

This is used for:

- Creating a polished public menu
- Posting the menu to Telegram
- Keeping a downloadable PDF version
- Presenting the menu in a consistent Ma’Maria visual style

The generated output includes the Ma’Maria branding, menu date, weekday, categories, product names, weights, and prices.

---

## Telegram Integration

The admin can generate a menu image from an Excel file and post it directly to a Telegram channel.

This allows Ma’Maria to publish the daily menu to customers without manually recreating the post.

The Telegram integration is handled on the backend so that bot credentials are never exposed to the client interface.

---

## SMS Phone Verification

The application supports phone number verification through SMS OTP.

This ensures that customers verify their phone number before placing orders.

The verification flow is:

1. Customer enters phone number
2. App sends an OTP code by SMS
3. Customer enters the code
4. Backend verifies the code
5. Customer account becomes verified

Only verified customers can place orders.

---

## Pickup Locations

Customers can choose one of the supported pickup locations during checkout.

The app is currently configured for the Ma’Maria / DRÄXLMAIER pickup workflow, including multiple pickup points.

---

## News Section

The app includes a news section for announcements, updates, and menu-related posts.

Admins can create and manage news posts from the admin panel.

Generated menu posts can also be connected with the news and Telegram publishing workflow.

---

## Technical Overview

The project is built with:

- Next.js App Router
- React
- TypeScript
- SQLite
- Better SQLite3
- Tailwind CSS
- Server-side API routes
- Excel parsing
- Menu image/PDF rendering
- Telegram Bot API integration
- SMS OTP verification integration

The application is designed to run as a single always-on Node.js process with persistent storage.

---

## Project Structure

```text
app/                  Application pages and API routes
components/           Shared UI components
lib/                  Backend utilities, database logic, auth, parsing, rendering
middleware.ts         Request middleware
public/               Public static assets
sample-data/          Example menu files for testing
scripts/              Utility scripts