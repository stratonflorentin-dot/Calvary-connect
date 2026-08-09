# Calvary Connect

> A unified fleet, logistics, operations, and financial management platform for Calvary Investment Company Ltd.

Calvary Connect is a modern logistics ERP designed to centralize the daily operations of a transport and fleet management company.

The platform connects fleet operations, trip management, drivers, finance, maintenance, communication, and management reporting in one system.

It is being developed for **Calvary Investment Company Ltd**, a Tanzania-based logistics and transport company.

## Overview

Managing a logistics company often requires information from several departments.

Drivers handle deliveries. Operators manage trips. Finance teams process expenses and invoices. Management needs accurate reports.

Calvary Connect brings these workflows together.

The goal is to give every authorized user access to the information and tools required for their role while keeping operational and financial data secure.

## Key Features

### Fleet Management

Manage the complete vehicle lifecycle.

* Register and manage vehicles
* Track vehicle status
* Store vehicle details and documents
* Monitor maintenance history
* Record repairs and servicing
* Track operational availability
* Maintain vehicle records

### Driver Management

Manage drivers and their operational activities.

* Driver profiles
* Vehicle assignments
* Trip assignments
* Driver activity records
* Document management
* Performance records

### Trip Management

Control the complete logistics workflow from assignment to delivery.

* Create trips
* Assign drivers and vehicles
* Record pickup and delivery locations
* Track trip status
* Record trip expenses
* Upload proof of delivery
* Maintain trip history

### Finance and Accounting

Connect operational activities with financial records.

* Create and manage invoices
* Record customer payments
* Track operational expenses
* Manage fuel expenses
* Monitor receivables
* Monitor payables
* Support multiple currencies
* Maintain separate bank accounts
* Support accounting workflows
* Generate financial reports

The system supports different financial treatment for different transport operations, including local and transit activities.

### Maintenance Management

Keep vehicles operational and reduce unexpected downtime.

* Schedule maintenance
* Record repairs
* Track service history
* Record maintenance expenses
* Monitor vehicle condition
* Track maintenance status

### Internal Communication

Improve coordination between employees and departments.

* One-to-one messaging
* Team communication
* User-based communication
* Real-time updates

### Reporting and Analytics

Give management a clear view of company performance.

Reports can cover:

* Fleet utilization
* Active and completed trips
* Revenue
* Expenses
* Fuel consumption
* Outstanding invoices
* Driver activity
* Vehicle performance
* Operational performance

## User Roles

Calvary Connect uses role-based access control.

### CEO

The CEO can access high-level company information.

Key areas include:

* Executive dashboard
* Financial performance
* Fleet performance
* Operational reports
* Company-wide analytics

### Administrator

Administrators manage system configuration and users.

Responsibilities include:

* User management
* Role management
* System configuration
* Data administration

### Operator

Operators manage daily logistics activities.

Responsibilities include:

* Creating trips
* Assigning drivers
* Assigning vehicles
* Updating trip status
* Managing operational records

### Driver

Drivers access only the tools required for their work.

Responsibilities include:

* Viewing assigned trips
* Updating trip progress
* Recording expenses
* Uploading proof of delivery
* Viewing assigned tasks

### Accountant

Accountants manage financial records.

Responsibilities include:

* Invoices
* Payments
* Expenses
* Bank accounts
* Financial reports
* Accounting records

### Human Resources

HR users manage employee-related records.

Responsibilities include:

* Employee information
* Driver records
* Staff information
* Employment documentation

## System Architecture

Calvary Connect is designed around connected business modules.

```text
                    ┌─────────────────────┐
                    │   CALVARY CONNECT   │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
   OPERATIONS               FINANCE                 MANAGEMENT
        │                      │                      │
   ┌────┼─────┐           ┌────┼─────┐           ┌────┼─────┐
   │    │     │           │    │     │           │    │     │
 FLEET TRIPS DRIVERS    INVOICES EXPENSES     REPORTS ANALYTICS
   │
 MAINTENANCE
```

## Technology Stack

The platform uses modern web technologies.

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

### Backend and Database

* Supabase
* PostgreSQL
* Supabase Authentication
* Row Level Security
* Realtime features

### Maps and Location

* Leaflet
* MapLibre

### Deployment

The project includes configuration for platforms such as:

* Vercel
* Firebase

## Getting Started

### Prerequisites

Install the following before running the project:

* Node.js 18 or later
* npm
* A Supabase project

### Clone the Repository

```bash
git clone https://github.com/stratonflorentin-dot/Calvary-connect.git
cd Calvary-connect
```

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create a `.env.local` file in the root directory.

Add the required environment variables.

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Add any additional variables required by the project configuration.

Do not commit `.env.local` files, API keys, passwords, or production credentials to GitHub.

### Start Development Server

```bash
npm run dev
```

Open the application at:

```text
http://localhost:3000
```

## Production Build

Build the application.

```bash
npm run build
```

Start the production server.

```bash
npm start
```

## Database

The project uses Supabase and PostgreSQL for data storage.

Database-related files and migrations are located in the repository.

Typical database areas include:

* Users
* Roles
* Profiles
* Vehicles
* Drivers
* Trips
* Customers
* Invoices
* Payments
* Expenses
* Maintenance
* Chat
* Notifications
* Financial records

Before deploying to production, review all database migrations and Row Level Security policies.

## Security

Calvary Connect handles operational and financial information.

Security measures should include:

* Authentication
* Role-based access control
* Row Level Security
* Protected API routes
* Secure environment variables
* Audit logging
* Input validation
* Secure database policies

Never expose the following in client-side code or public repositories:

* Service role keys
* Database passwords
* Private API keys
* Production credentials
* Customer confidential data

## Project Structure

```text
Calvary-connect/
│
├── src/                    # Application source code
│   ├── app/                # Next.js routes and pages
│   ├── components/         # Reusable UI components
│   ├── lib/                # Utilities and services
│   └── types/              # TypeScript definitions
│
├── public/                 # Static files
│
├── supabase/
│   └── migrations/         # Database migrations
│
├── database/               # Database-related files
│
├── docs/                   # Project documentation
│
├── scripts/                # Development and utility scripts
│
├── package.json
├── next.config.*
└── README.md
```

## Roadmap

Future development may include:

* Advanced fleet analytics
* GPS and route integration
* Predictive maintenance
* Fuel consumption analysis
* Automated financial reporting
* Mobile driver experience
* Document expiry alerts
* Vehicle insurance alerts
* AI-powered operational insights
* Advanced management dashboards
* Cross-border logistics workflows
* Customer portal

## Development Principles

The project focuses on:

* Clear separation of modules
* Role-based access
* Secure financial data
* Scalable architecture
* Maintainable code
* Mobile responsiveness
* Reliable database policies
* Accurate operational reporting

## Contributing

Calvary Connect is proprietary software owned by Calvary Investment Company Ltd.

External contributions require authorization.

Authorized contributors should:

1. Create a feature branch.
2. Make focused changes.
3. Test the application.
4. Review security implications.
5. Submit a pull request.

## License

This project is proprietary software.

Copyright © 2026 Calvary Investment Company Ltd.

All rights reserved.

Unauthorized copying, modification, distribution, commercial use, or redistribution of this software is prohibited without prior written permission.

See the [LICENSE](LICENSE) file for full terms.

## Company

**Calvary Investment Company Ltd.**

Dar es Salaam, Tanzania.

Calvary Connect is being developed to support digital transformation across logistics, fleet operations, finance, and management.

## Project Status

🚧 **Active Development**

The system is currently under active development and features may change as the platform evolves.

---

Built for smarter logistics operations.
