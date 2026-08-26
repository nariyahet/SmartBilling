# SmartBilling – Billing & Invoice Management System

SmartBilling is a full-stack billing and invoice management system designed to help businesses manage products, customers, invoices, stock, and sales through a modern web application.

The project demonstrates practical full-stack development using React.js, Node.js, Express.js, MySQL, REST APIs, JWT authentication, and responsive UI design.

## 🚀 Live Demo

**Live Application:** https://smartbilling-sigma.vercel.app/

## 🔐 Demo Login

Use the following credentials to explore the application:

**Email:** `demo@smartbilling.com`

**Password:** `Demo@12345`

> Demo credentials are provided for portfolio and demonstration purposes.

## ✨ Features

### 🔐 Authentication

* Secure admin authentication
* JWT-based authentication
* Password hashing with bcrypt
* Protected routes
* Token-based authorization
* Demo account for testing

### 📦 Product Management

* Add products
* Manage product information
* Update product details
* Track product prices
* Track stock quantity
* Low-stock management

### 👥 Customer Management

* Add customers
* Store customer contact information
* Manage customer records
* View customer details

### 🧾 Invoice Management

* Create professional invoices
* Add multiple products to invoices
* Automatic subtotal calculation
* Discount calculation
* Tax calculation
* Grand total calculation
* Invoice number generation
* Invoice history
* Invoice PDF generation

### 📊 Dashboard

* Total customers
* Total products
* Total invoices
* Total sales
* Today's sales
* Business overview

### 📱 Responsive Design

* Responsive interface
* Desktop-friendly dashboard
* Mobile-friendly layouts
* Clean and modern UI

## 🛠️ Tech Stack

### Frontend

* React.js
* Vite
* JavaScript
* HTML5
* CSS3
* Axios
* React Router
* html2pdf.js

### Backend

* Node.js
* Express.js
* REST API
* JWT
* bcrypt
* CORS
* dotenv
* MySQL2

### Database

* MySQL
* Relational database design
* Foreign key relationships
* Connection management

### Development Tools

* Git
* GitHub
* VS Code
* npm

## 📁 Project Structure

```text
SmartBilling/
│
├── client/
│   ├── src/
│   │   ├── api/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   │
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   ├── createAdmin.js
│   ├── server.js
│   └── package.json
│
├── database/
│   ├── schema.sql
│   └── seed.sql
│
├── .gitignore
└── README.md
```

## ⚙️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/nariyahet/SmartBilling.git
```

### 2. Open the Project

```bash
cd SmartBilling
```

## 🎨 Frontend Setup

Navigate to the client folder:

```bash
cd client
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will be available at the Vite URL shown in the terminal.

## ⚙️ Backend Setup

Open another terminal and navigate to:

```bash
cd server
```

Install dependencies:

```bash
npm install
```

Create a `.env` file inside the `server` directory:

```env
PORT=5000

DB_HOST=your_database_host
DB_PORT=3306
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name

JWT_SECRET=your_jwt_secret
```

Start the backend:

```bash
npm start
```

For development:

```bash
npm run dev
```

## 🗄️ Database Setup

Create the database:

```sql
CREATE DATABASE smartbilling;
```

Then execute the database schema:

```text
database/schema.sql
```

You can optionally use the seed data:

```text
database/seed.sql
```

## 🔒 Environment Variables

Sensitive configuration is intentionally excluded from GitHub.

The `.env` file should contain:

```env
PORT=5000
DB_HOST=your_database_host
DB_PORT=3306
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name
JWT_SECRET=your_jwt_secret
```

**Never commit your real `.env` file to GitHub.**

## 🔌 API

The backend provides RESTful APIs for:

* Authentication
* Products
* Customers
* Invoices
* Dashboard statistics
* Protected admin operations

Local backend:

```text
http://localhost:5000
```

API prefix:

```text
/api
```

## 🔐 Security

The application implements:

* JWT authentication
* bcrypt password hashing
* Protected API routes
* Authorization middleware
* Environment-based configuration
* CORS configuration
* Database parameterized queries

Passwords are never stored as plain text.

## 📈 Dashboard

The dashboard provides an overview of business activity, including:

* Total customers
* Total products
* Total invoices
* Total sales
* Today's sales

## 🧾 Invoice Generation

SmartBilling provides professional invoice generation with:

* Customer information
* Product details
* Quantity
* Product price
* Subtotal
* Discount
* Tax
* Grand total

Invoices can be generated and downloaded as PDF documents.

## 🎯 Project Purpose

SmartBilling was developed as a full-stack portfolio project to demonstrate practical experience in:

* React.js
* Node.js
* Express.js
* MySQL
* REST API development
* JWT authentication
* Password hashing
* CRUD operations
* Database relationships
* Invoice generation
* PDF generation
* Responsive web development
* Git and GitHub

## 👨‍💻 Developer

**Het Nariya**

Full Stack Web Developer

### Skills Demonstrated

`React.js` · `Node.js` · `Express.js` · `JavaScript` · `MySQL` · `REST API` · `JWT` · `bcrypt` · `Git` · `GitHub` · `Responsive Web Design`

## 📄 License

This project is created for educational, portfolio, and demonstration purposes.
